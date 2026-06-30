# Researcher Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins assign and manage a researcher for any user, and let that user see the researcher's info read-only on their profile.

**Architecture:** A `researcher` sub-document embedded on the `User` model. A pure validator normalizes the admin's input. A new admin-guarded API route (PUT/DELETE) writes it. The admin Users table gains a dialog to manage it; the user's `/profile` page reads and displays it server-side.

**Tech Stack:** Next.js 16 App Router, Mongoose 9, NextAuth v5, SWR, React 19, TypeScript, Vitest, shadcn/ui.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/types`, `@/components/...`.
- Mongoose models use hot-reload guard: `models.X ?? model("X", Schema)`.
- Admin API handlers guard with `getAdminSession()` from `@/lib/adminAuth` → 403 `{ error: "Forbidden" }` if not admin. Then `connectDB()`. Route params are `Promise<{...}>`, awaited.
- Researcher status enum is exactly `'Assigned' | 'In Progress' | 'Completed'`.
- `fullName` and `contact` are required; `notes` and `assignmentDate` optional; `assignmentDate` defaults to today (`YYYY-MM-DD`); `status` defaults to `'Assigned'`.
- New UI strings are hardcoded English (match the person-profile relationship UI precedent).
- DTO types live in `types/index.ts`.

---

### Task 1: Researcher type + validator (pure, TDD)

**Files:**
- Modify: `types/index.ts` — add `IResearcher`, extend `IUser`
- Create: `lib/researcher.ts`
- Test: `lib/researcher.test.ts`

**Interfaces:**
- Produces:
  - `RESEARCHER_STATUSES: readonly ['Assigned','In Progress','Completed']`
  - `type ResearcherStatus = 'Assigned' | 'In Progress' | 'Completed'`
  - `validateResearcher(input: unknown, today: string): { ok: true; value: { fullName: string; contact: string; notes?: string; assignmentDate: string; status: ResearcherStatus } } | { ok: false; error: string }`
  - `IResearcher` (DTO in `types/index.ts`)

- [ ] **Step 1: Add the DTO types**

In `types/index.ts`, add after the `IUser` interface (or near it):

```ts
export interface IResearcher {
  fullName: string
  contact: string
  notes?: string
  assignmentDate?: string
  status: 'Assigned' | 'In Progress' | 'Completed'
}
```

And add to the existing `IUser` interface:

```ts
  researcher?: IResearcher
```

- [ ] **Step 2: Write the failing test**

Create `lib/researcher.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateResearcher } from "./researcher";

const TODAY = "2026-07-01";

describe("validateResearcher", () => {
  it("accepts a full valid payload", () => {
    const r = validateResearcher(
      { fullName: "Dr. Jane Roe", contact: "jane@x.com", notes: "n", assignmentDate: "2026-06-01", status: "In Progress" },
      TODAY
    );
    expect(r).toEqual({
      ok: true,
      value: { fullName: "Dr. Jane Roe", contact: "jane@x.com", notes: "n", assignmentDate: "2026-06-01", status: "In Progress" },
    });
  });

  it("defaults status to Assigned and assignmentDate to today", () => {
    const r = validateResearcher({ fullName: "A", contact: "b" }, TODAY);
    expect(r).toEqual({
      ok: true,
      value: { fullName: "A", contact: "b", assignmentDate: TODAY, status: "Assigned" },
    });
  });

  it("trims whitespace and omits empty notes", () => {
    const r = validateResearcher({ fullName: "  A  ", contact: " b ", notes: "   " }, TODAY);
    expect(r.ok && r.value.fullName).toBe("A");
    expect(r.ok && r.value.contact).toBe("b");
    expect(r.ok && "notes" in r.value).toBe(false);
  });

  it("rejects missing fullName or contact", () => {
    expect(validateResearcher({ contact: "b" }, TODAY).ok).toBe(false);
    expect(validateResearcher({ fullName: "  ", contact: "b" }, TODAY).ok).toBe(false);
    expect(validateResearcher({ fullName: "a" }, TODAY).ok).toBe(false);
  });

  it("rejects an invalid status", () => {
    const r = validateResearcher({ fullName: "a", contact: "b", status: "Done" }, TODAY);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/researcher.test.ts`
Expected: FAIL — cannot resolve `./researcher`.

- [ ] **Step 4: Write the implementation**

Create `lib/researcher.ts`:

```ts
export const RESEARCHER_STATUSES = ["Assigned", "In Progress", "Completed"] as const;
export type ResearcherStatus = (typeof RESEARCHER_STATUSES)[number];

export interface ResearcherValue {
  fullName: string;
  contact: string;
  notes?: string;
  assignmentDate: string;
  status: ResearcherStatus;
}

type Result =
  | { ok: true; value: ResearcherValue }
  | { ok: false; error: string };

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function validateResearcher(input: unknown, today: string): Result {
  const obj = (input ?? {}) as Record<string, unknown>;

  const fullName = asTrimmedString(obj.fullName);
  const contact = asTrimmedString(obj.contact);
  if (!fullName) return { ok: false, error: "fullName is required" };
  if (!contact) return { ok: false, error: "contact is required" };

  let status: ResearcherStatus = "Assigned";
  if (obj.status !== undefined && obj.status !== null && obj.status !== "") {
    if (!RESEARCHER_STATUSES.includes(obj.status as ResearcherStatus))
      return { ok: false, error: "invalid status" };
    status = obj.status as ResearcherStatus;
  }

  const assignmentDate = asTrimmedString(obj.assignmentDate) || today;
  const notes = asTrimmedString(obj.notes);

  const value: ResearcherValue = { fullName, contact, assignmentDate, status };
  if (notes) value.notes = notes;

  return { ok: true, value };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/researcher.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add types/index.ts lib/researcher.ts lib/researcher.test.ts
git commit -m "feat: researcher type + input validator"
```

---

### Task 2: User model `researcher` sub-document

**Files:**
- Modify: `lib/models/User.ts`

**Interfaces:**
- Consumes: the `'Assigned' | 'In Progress' | 'Completed'` enum (inline literal in schema).
- Produces: `IUserDoc.researcher?` field readable/writable via Mongoose.

- [ ] **Step 1: Add the sub-document to the interface**

In `lib/models/User.ts`, add to `IUserDoc` (after `bio?`):

```ts
  researcher?: {
    fullName: string;
    contact: string;
    notes?: string;
    assignmentDate?: string;
    status: "Assigned" | "In Progress" | "Completed";
  };
```

- [ ] **Step 2: Add the schema field**

In the `UserSchema` definition, add after `bio`:

```ts
    researcher: {
      type: new Schema(
        {
          fullName: { type: String, required: true },
          contact: { type: String, required: true },
          notes: { type: String },
          assignmentDate: { type: String },
          status: {
            type: String,
            enum: ["Assigned", "In Progress", "Completed"],
            default: "Assigned",
          },
        },
        { _id: false }
      ),
      required: false,
    },
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/models/User.ts
git commit -m "feat: embed researcher sub-document on User"
```

---

### Task 3: Admin researcher API route

**Files:**
- Create: `app/api/admin/users/[userId]/researcher/route.ts`

**Interfaces:**
- Consumes: `getAdminSession` (`@/lib/adminAuth`), `connectDB` (`@/lib/db`), `User` (`@/lib/models/User`), `validateResearcher` (Task 1).
- Produces: `PUT` and `DELETE /api/admin/users/[userId]/researcher` → updated user (minus password) or error.

- [ ] **Step 1: Write the route**

Create `app/api/admin/users/[userId]/researcher/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { validateResearcher } from "@/lib/researcher";

type Params = { params: Promise<{ userId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const body = await req.json();
  const today = new Date().toISOString().slice(0, 10);
  const result = validateResearcher(body, today);
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { researcher: result.value } },
    { new: true, projection: { password: 0 } }
  );
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  await connectDB();
  const user = await User.findByIdAndUpdate(
    userId,
    { $unset: { researcher: 1 } },
    { new: true, projection: { password: 0 } }
  );
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke (deferred — interactive)**

Live test needs an authenticated admin session; deferred to the controller/user. Statically confirm: 403 without admin session, 400 on missing fullName/contact or bad status, 404 for unknown userId, `$set` on PUT and `$unset` on DELETE, password projected out.

- [ ] **Step 4: Commit**

```bash
git add "app/api/admin/users/[userId]/researcher"
git commit -m "feat: admin API to assign/unassign a user's researcher"
```

---

### Task 4: Admin Users table — researcher dialog

**Files:**
- Modify: `app/(dashboard)/admin/users/page.tsx`

**Interfaces:**
- Consumes: researcher API (Task 3); `IResearcher`/status type (Task 1); existing `Dialog`, `Select`, `Button`, `Input`, `Label`, `Textarea`.

- [ ] **Step 1: Extend imports and the AdminUser type**

At the top of `app/(dashboard)/admin/users/page.tsx`, add imports:

```ts
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RESEARCHER_STATUSES, type ResearcherStatus } from "@/lib/researcher"
import type { IResearcher } from "@/types"
```

Extend the `AdminUser` interface with:

```ts
  researcher?: IResearcher
```

- [ ] **Step 2: Add researcher dialog state + handlers**

Inside `AdminUsersPage`, after the existing `deleteTarget`/`loading` state, add:

```ts
  const [researcherTarget, setResearcherTarget] = useState<AdminUser | null>(null)
  const [rForm, setRForm] = useState({
    fullName: "", contact: "", notes: "", assignmentDate: "",
    status: "Assigned" as ResearcherStatus,
  })
  const [rSaving, setRSaving] = useState(false)

  function openResearcher(user: AdminUser) {
    const r = user.researcher
    setRForm({
      fullName: r?.fullName ?? "",
      contact: r?.contact ?? "",
      notes: r?.notes ?? "",
      assignmentDate: r?.assignmentDate ?? "",
      status: (r?.status as ResearcherStatus) ?? "Assigned",
    })
    setResearcherTarget(user)
  }

  async function saveResearcher() {
    if (!researcherTarget || !rForm.fullName.trim() || !rForm.contact.trim()) return
    setRSaving(true)
    const res = await fetch(`/api/admin/users/${researcherTarget._id}/researcher`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rForm),
    })
    if (res.ok) { await mutate(); setResearcherTarget(null) }
    setRSaving(false)
  }

  async function unassignResearcher() {
    if (!researcherTarget) return
    setRSaving(true)
    const res = await fetch(`/api/admin/users/${researcherTarget._id}/researcher`, {
      method: "DELETE",
    })
    if (res.ok) { await mutate(); setResearcherTarget(null) }
    setRSaving(false)
  }
```

- [ ] **Step 3: Add the Researcher button in the row action cell**

In the action `<td>` (currently holding the delete `Button`), add the Researcher button BEFORE the delete button, and a small status hint. Replace the action cell:

```tsx
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.researcher && (
                        <span className="text-[11px] text-gray-500">{user.researcher.status}</span>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openResearcher(user)}>
                        Researcher
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf}
                        onClick={() => setDeleteTarget(user)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
```

- [ ] **Step 4: Add the researcher dialog**

After the existing delete `Dialog` (before the closing `</div>` of the component return), add:

```tsx
      <Dialog open={!!researcherTarget} onOpenChange={(open) => { if (!open) setResearcherTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Researcher — {researcherTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={rForm.fullName} onChange={(e) => setRForm({ ...rForm, fullName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Input
                value={rForm.contact}
                placeholder="email, phone, or preferred method"
                onChange={(e) => setRForm({ ...rForm, contact: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={rForm.notes} onChange={(e) => setRForm({ ...rForm, notes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Assignment date</Label>
              <Input type="date" value={rForm.assignmentDate} onChange={(e) => setRForm({ ...rForm, assignmentDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={rForm.status} onValueChange={(v) => setRForm({ ...rForm, status: v as ResearcherStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESEARCHER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {researcherTarget?.researcher && (
              <Button variant="outline" onClick={unassignResearcher} disabled={rSaving} className="text-destructive hover:text-destructive mr-auto">
                Unassign
              </Button>
            )}
            <Button variant="outline" onClick={() => setResearcherTarget(null)}>Cancel</Button>
            <Button onClick={saveResearcher} disabled={rSaving || !rForm.fullName.trim() || !rForm.contact.trim()}>
              {rSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 5: Verify compile + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in this file (pre-existing unrelated lint issues may remain).

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/admin/users/page.tsx"
git commit -m "feat: admin Users table researcher assign/edit/unassign dialog"
```

---

### Task 5: Profile researcher card

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

**Interfaces:**
- Consumes: `auth` (`@/lib/auth`), `connectDB` (`@/lib/db`), `User` (`@/lib/models/User`), existing `Card`/`Badge`.

- [ ] **Step 1: Read the researcher server-side**

In `app/(dashboard)/profile/page.tsx`, add imports:

```ts
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { Badge } from "@/components/ui/badge"
import type { IResearcher } from "@/types"
```

After the `if (!session?.user) redirect("/login")` guard, fetch the researcher:

```ts
  await connectDB()
  const me = await User.findById(session.user.id, { researcher: 1 }).lean<{ researcher?: IResearcher } | null>()
  const researcher = me?.researcher
```

- [ ] **Step 2: Render the Researcher card**

Add this `Card` after the existing profile `Card` (inside the `max-w-2xl` wrapper, e.g. wrap both in a `space-y-6` container if not already):

```tsx
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Researcher</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {researcher ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{researcher.fullName}</span>
                <Badge variant="secondary">{researcher.status}</Badge>
              </div>
              <p className="text-muted-foreground">{researcher.contact}</p>
              {researcher.notes && <p className="text-muted-foreground">{researcher.notes}</p>}
              {researcher.assignmentDate && (
                <p className="text-xs text-muted-foreground">Assigned: {researcher.assignmentDate}</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No researcher assigned yet.</p>
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 3: Verify compile + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in this file.

- [ ] **Step 4: Manual end-to-end verification (deferred — interactive)**

Run `npm run dev`. As an admin: open Admin → Users, click Researcher on a user, fill the fields, Save → reopen shows persisted values; change status; Unassign clears it. As that user: open `/profile` → Researcher card shows the info; after unassign → "No researcher assigned yet." As a non-admin, `PUT/DELETE /api/admin/users/<id>/researcher` → 403.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/profile/page.tsx"
git commit -m "feat: show assigned researcher on user profile"
```

---

## Self-review notes

- **Spec coverage:** data model (Task 1 DTO + Task 2 schema) ✓; admin-only assign/manage (Task 3 API + Task 4 UI) ✓; fields fullName/contact/notes/assignmentDate/status (Tasks 1–4) ✓; user sees researcher on profile (Task 5) ✓; hardcoded English (Tasks 4–5) ✓; admin-only enforced server-side (Task 3 `getAdminSession`) ✓.
- **Type consistency:** `IResearcher` shape (fullName, contact, notes?, assignmentDate?, status) identical across `types/index.ts`, User schema, validator `ResearcherValue`, admin form, and profile card. Status enum identical everywhere. `validateResearcher(input, today)` signature consistent between Task 1 and Task 3.
- **No placeholders:** every step has full code.
