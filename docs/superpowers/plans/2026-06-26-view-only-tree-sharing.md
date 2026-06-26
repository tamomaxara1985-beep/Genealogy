# View-Only Tree Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tree owner grant view-only access to other people by email and revoke it anytime; viewers can open the tree read-only but cannot change anything.

**Architecture:** Add a `sharedEmails` string array to the `Tree` document. A central `lib/treeAccess.ts` helper resolves a caller's role (`owner` | `viewer` | `null`) from the session. GET routes are relaxed to allow owner OR viewer; write routes stay owner-only (already enforced) so viewers are physically blocked from mutations server-side. A share-management API grants/revokes emails. The frontend reads the caller's `role` from the tree fetch and hides all mutation affordances in read-only mode, adds an owner-only Share dialog, and lists "Shared with me" trees.

**Tech Stack:** Next.js 16 App Router (route handlers), React 19, NextAuth v5, Mongoose 9, SWR, shadcn/ui, Tailwind CSS v4, next-intl.

## Global Constraints

- No new dependencies.
- Mongoose schema change limited to the additive `sharedEmails` field on `Tree`.
- Emails stored **lowercased and trimmed**; matching is case-insensitive.
- Server-side authorization is the source of truth; UI gating is convenience only. Write routes (POST/PUT/DELETE/PATCH) remain owner-only — do NOT relax them.
- Route pattern: `await auth()`; return 401 if no session; return 404 if the caller has no access (never leak tree existence).
- `GET /api/trees/[treeId]` must NOT return `sharedEmails` unless the caller is the owner.
- TypeScript strict; Tailwind classes only; `cn()` from `lib/utils.ts`; `@/*` path alias; `"use client"` only where already present or where hooks/events require it.
- No automated test runner is configured (Playwright e2e only, unused). Verification = `npm run build` (must pass clean) + the manual cross-account smoke tests in each task. The implementer runs the build; cross-account browser/curl checks needing two logged-in users are for the human reviewer.

---

### Task 1: Data model, types, and session email

**Files:**
- Modify: `lib/models/Tree.ts`
- Modify: `types/index.ts`
- Modify: `lib/auth.ts`

**Interfaces:**
- Produces: `ITreeDoc.sharedEmails: string[]`; `ITree.sharedEmails?: string[]`; `ITree.role?: "owner" | "viewer"`; `session.user.email` reliably populated (string | null | undefined).

- [ ] **Step 1: Add `sharedEmails` to the Tree model**

In `lib/models/Tree.ts`, add to `ITreeDoc` (after `isPublic: boolean;`):

```ts
  sharedEmails: string[];
```

And add to the schema object (after the `isPublic` field):

```ts
    sharedEmails: { type: [String], default: [] },
```

- [ ] **Step 2: Extend the DTO types**

In `types/index.ts`, replace the `ITree` interface with:

```ts
export interface ITree {
  _id: string
  name: string
  description?: string
  ownerId: string
  isPublic: boolean
  sharedEmails?: string[]
  role?: 'owner' | 'viewer'
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 3: Ensure the session exposes the user's email**

In `lib/auth.ts`, replace the `session` callback with (adds email defensively; id/role unchanged):

```ts
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as string;
      if (token.email) session.user.email = token.email as string;
      return session;
    },
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: clean compile, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add lib/models/Tree.ts types/index.ts lib/auth.ts
git commit -m "feat: add sharedEmails to Tree model and expose session email"
```

---

### Task 2: Central access helper

**Files:**
- Create: `lib/treeAccess.ts`

**Interfaces:**
- Consumes: `Tree` (default export + `ITreeDoc`) from `lib/models/Tree`; `Person` (default export + `IPersonDoc`) from `lib/models/Person`; `connectDB` from `lib/db`; `Session` from `next-auth`.
- Produces:
  - `type TreeRole = "owner" | "viewer" | null`
  - `resolveTreeAccess(treeId: string, session: Session | null): Promise<{ tree: ITreeDoc | null; role: TreeRole }>`
  - `resolvePersonAccess(personId: string, session: Session | null): Promise<{ person: IPersonDoc | null; role: TreeRole }>`
  - Both return `null`/`null` when the caller lacks access OR the document does not exist (callers treat this as 404).

- [ ] **Step 1: Create the helper**

Create `lib/treeAccess.ts`:

```ts
import type { Session } from "next-auth";
import { connectDB } from "@/lib/db";
import Tree, { type ITreeDoc } from "@/lib/models/Tree";
import Person, { type IPersonDoc } from "@/lib/models/Person";

export type TreeRole = "owner" | "viewer" | null;

// Resolve the caller's access to a tree. Returns the tree doc and role, or
// { tree: null, role: null } if the tree does not exist or the caller has no access.
export async function resolveTreeAccess(
  treeId: string,
  session: Session | null
): Promise<{ tree: ITreeDoc | null; role: TreeRole }> {
  const userId = session?.user?.id;
  if (!userId) return { tree: null, role: null };

  await connectDB();
  const tree = await Tree.findById(treeId);
  if (!tree) return { tree: null, role: null };

  if (tree.ownerId.toString() === userId) return { tree, role: "owner" };

  const email = session.user?.email?.toLowerCase();
  if (email && tree.sharedEmails?.some((e) => e.toLowerCase() === email)) {
    return { tree, role: "viewer" };
  }

  return { tree: null, role: null };
}

// Resolve the caller's access to a person via that person's tree.
export async function resolvePersonAccess(
  personId: string,
  session: Session | null
): Promise<{ person: IPersonDoc | null; role: TreeRole }> {
  const userId = session?.user?.id;
  if (!userId) return { person: null, role: null };

  await connectDB();
  const person = await Person.findById(personId);
  if (!person) return { person: null, role: null };

  const { tree, role } = await resolveTreeAccess(person.treeId.toString(), session);
  if (!tree || !role) return { person: null, role: null };
  return { person, role };
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: clean compile. (The helper is exercised by Tasks 3–4.)

- [ ] **Step 3: Commit**

```bash
git add lib/treeAccess.ts
git commit -m "feat: add resolveTreeAccess/resolvePersonAccess helper"
```

---

### Task 3: Relax READ authorization on GET routes

**Files:**
- Modify: `app/api/trees/[treeId]/route.ts` (GET only)
- Modify: `app/api/trees/[treeId]/persons/route.ts` (GET only)
- Modify: `app/api/trees/[treeId]/relationships/route.ts` (GET only)
- Modify: `app/api/persons/[personId]/route.ts` (GET only)
- Modify: `app/api/persons/[personId]/events/route.ts` (GET only)

**Interfaces:**
- Consumes: `resolveTreeAccess`, `resolvePersonAccess` from `lib/treeAccess`.
- Produces: `GET /api/trees/[treeId]` returns the tree object with an added `role` field and `sharedEmails` only for the owner. Other GETs return their existing payloads to owner or viewer.

Do NOT touch the POST/PUT/DELETE handlers in these files — they keep their owner-only `Tree.findOne({ _id, ownerId })` query.

- [ ] **Step 1: Tree GET — allow viewer, add `role`, strip `sharedEmails` for non-owners**

In `app/api/trees/[treeId]/route.ts`, add the import at the top:

```ts
import { resolveTreeAccess } from "@/lib/treeAccess";
```

Replace the `GET` function with:

```ts
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const { tree, role } = await resolveTreeAccess(treeId, session);
  if (!tree || !role)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const obj = tree.toObject() as Record<string, unknown>;
  if (role !== "owner") delete obj.sharedEmails;
  return NextResponse.json({ ...obj, role });
}
```

- [ ] **Step 2: Persons GET — allow viewer**

In `app/api/trees/[treeId]/persons/route.ts`, add at the top:

```ts
import { resolveTreeAccess } from "@/lib/treeAccess";
```

Replace the `GET` function with:

```ts
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const { tree, role } = await resolveTreeAccess(treeId, session);
  if (!tree || !role)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const persons = await Person.find({ treeId }).sort({ lastName: 1 });
  return NextResponse.json(persons);
}
```

(Leave the existing `POST` handler untouched — it stays owner-only.)

- [ ] **Step 3: Relationships GET — allow viewer**

In `app/api/trees/[treeId]/relationships/route.ts`, add at the top:

```ts
import { resolveTreeAccess } from "@/lib/treeAccess";
```

Replace the `GET` function with:

```ts
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const { tree, role } = await resolveTreeAccess(treeId, session);
  if (!tree || !role)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const relationships = await Relationship.find({ treeId });
  return NextResponse.json(relationships);
}
```

(Leave `POST` untouched.)

- [ ] **Step 4: Person detail GET — allow viewer**

In `app/api/persons/[personId]/route.ts`, add at the top:

```ts
import { resolvePersonAccess } from "@/lib/treeAccess";
```

Replace the `GET` function with (note: PUT and DELETE keep using the existing `authorizePersonAccess` owner-only helper — do not change them):

```ts
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { personId } = await params;
  const { person, role } = await resolvePersonAccess(personId, session);
  if (!person || !role)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(person);
}
```

- [ ] **Step 5: Person events GET — allow viewer**

In `app/api/persons/[personId]/events/route.ts`, add at the top:

```ts
import { resolvePersonAccess } from "@/lib/treeAccess";
```

Replace the `GET` function with:

```ts
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { personId } = await params;
  const { person, role } = await resolvePersonAccess(personId, session);
  if (!person || !role)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await Event.find({ personId }).sort({ date: 1 });
  return NextResponse.json(events);
}
```

(Leave `POST` untouched — it stays owner-only.)

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: clean compile.

- [ ] **Step 7: Manual smoke test — owner still works**

1. `npm run dev`, log in as the tree owner, open a tree.
2. Expected: tree, persons, relationships all load as before.
3. In the browser devtools Network tab, inspect `GET /api/trees/<id>` — response includes `"role": "owner"` and `sharedEmails` (likely `[]`).

- [ ] **Step 8: Commit**

```bash
git add app/api/trees/[treeId]/route.ts app/api/trees/[treeId]/persons/route.ts app/api/trees/[treeId]/relationships/route.ts app/api/persons/[personId]/route.ts app/api/persons/[personId]/events/route.ts
git commit -m "feat: allow shared viewers read access to tree GET routes"
```

---

### Task 4: Share-management API + shared trees in list

**Files:**
- Create: `app/api/trees/[treeId]/shares/route.ts`
- Modify: `app/api/trees/route.ts` (GET only)

**Interfaces:**
- Consumes: `resolveTreeAccess` from `lib/treeAccess`; `Tree` from `lib/models/Tree`; `auth` from `lib/auth`.
- Produces:
  - `POST /api/trees/[treeId]/shares` body `{ email: string }` → owner-only → `{ sharedEmails: string[] }`.
  - `DELETE /api/trees/[treeId]/shares` body `{ email: string }` → owner-only → `{ sharedEmails: string[] }`.
  - `GET /api/trees` → `{ owned: ITree[]; shared: ITree[] }`.

- [ ] **Step 1: Create the shares route**

Create `app/api/trees/[treeId]/shares/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Tree from "@/lib/models/Tree";
import { resolveTreeAccess } from "@/lib/treeAccess";

type Params = { params: Promise<{ treeId: string }> };

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

async function requireOwner(treeId: string, session: Awaited<ReturnType<typeof auth>>) {
  const { tree, role } = await resolveTreeAccess(treeId, session);
  return role === "owner" ? tree : null;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const tree = await requireOwner(treeId, session);
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const email = normalizeEmail(body.email);
  if (!email)
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  if (email === session.user.email?.toLowerCase())
    return NextResponse.json({ error: "You cannot share a tree with yourself" }, { status: 400 });

  await Tree.updateOne({ _id: treeId }, { $addToSet: { sharedEmails: email } });
  const updated = await Tree.findById(treeId);
  return NextResponse.json({ sharedEmails: updated?.sharedEmails ?? [] });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const tree = await requireOwner(treeId, session);
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const email = normalizeEmail(body.email);
  if (!email)
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  await Tree.updateOne({ _id: treeId }, { $pull: { sharedEmails: email } });
  const updated = await Tree.findById(treeId);
  return NextResponse.json({ sharedEmails: updated?.sharedEmails ?? [] });
}
```

- [ ] **Step 2: Trees list GET returns owned + shared**

In `app/api/trees/route.ts`, replace the `GET` function with:

```ts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const owned = await Tree.find({ ownerId: session.user.id }).sort({
    updatedAt: -1,
  });

  const email = session.user.email?.toLowerCase();
  const shared = email
    ? await Tree.find({
        sharedEmails: email,
        ownerId: { $ne: session.user.id },
      }).sort({ updatedAt: -1 })
    : [];

  return NextResponse.json({ owned, shared });
}
```

(Leave the `POST` handler untouched.)

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: clean compile.

- [ ] **Step 4: Manual smoke test — grant and revoke**

1. `npm run dev`, log in as the owner.
2. Grant: `curl` (with the owner's session cookie) or via the UI in Task 6. For a quick API check, in devtools console on the app origin:
   ```js
   await fetch('/api/trees/<treeId>/shares', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'viewer@example.com'})}).then(r=>r.json())
   ```
   Expected: `{ sharedEmails: ["viewer@example.com"] }`.
3. Revoke with `DELETE` (same body) → `{ sharedEmails: [] }`.
4. Self-share attempt with the owner's own email → 400.

- [ ] **Step 5: Commit**

```bash
git add app/api/trees/[treeId]/shares/route.ts app/api/trees/route.ts
git commit -m "feat: add share grant/revoke API and shared trees in list"
```

---

### Task 5: Trees list — "Shared with me" section

**Files:**
- Modify: `hooks/useTrees.ts`
- Modify: `app/(dashboard)/trees/page.tsx`
- Modify: `messages/en.json` (and any other locale files in `messages/`)

**Interfaces:**
- Consumes: `GET /api/trees` → `{ owned, shared }` (Task 4).
- Produces: `useTrees()` returns `{ owned: ITree[]; shared: ITree[]; error; isLoading; mutate }`.

- [ ] **Step 1: Update the hook**

Replace `hooks/useTrees.ts` with:

```ts
import useSWR from "swr";
import type { ITree } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTrees() {
  const { data, error, isLoading, mutate } = useSWR<{
    owned: ITree[];
    shared: ITree[];
  }>("/api/trees", fetcher);
  return {
    owned: data?.owned ?? [],
    shared: data?.shared ?? [],
    error,
    isLoading,
    mutate,
  };
}
```

- [ ] **Step 2: Add i18n strings**

In `messages/en.json`, under the `"tree"` object, add:

```json
      "myTrees": "My Trees",
      "sharedWithMe": "Shared with me",
      "viewOnly": "View-only",
```

If other locale files exist in `messages/` (e.g. `ru.json`, `ka.json`), add the same three keys to each `"tree"` object with the English text as a fallback value (translations can be refined later — do not leave the keys missing or the app throws).

- [ ] **Step 3: Render owned + shared sections**

In `app/(dashboard)/trees/page.tsx`, change the hook destructuring (line ~16) from:

```tsx
  const { trees, isLoading, mutate } = useTrees()
```
to:
```tsx
  const { owned, shared, isLoading, mutate } = useTrees()
```

Then replace the grid block (the `<div className="grid ...">` … `</div>` that maps `trees`) with:

```tsx
      {!isLoading && (
        <>
          <h2 className="text-lg font-semibold mb-3">{t("myTrees")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {owned.map((tree) => (
              <Card
                key={tree._id}
                className="cursor-pointer hover:border-amber-400 transition-colors"
                onClick={() => router.push(`/trees/${tree._id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{tree.name}</CardTitle>
                </CardHeader>
                {tree.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{tree.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}

            {owned.length === 0 && (
              <Card
                className="border-dashed border-2 flex items-center justify-center min-h-40 cursor-pointer hover:border-amber-400"
                onClick={() => setShowForm(true)}
              >
                <CardContent className="text-center pt-6">
                  <p className="text-muted-foreground">{t("createFirst")}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {shared.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-8 mb-3">{t("sharedWithMe")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shared.map((tree) => (
                  <Card
                    key={tree._id}
                    className="cursor-pointer hover:border-amber-400 transition-colors"
                    onClick={() => router.push(`/trees/${tree._id}`)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                      <CardTitle className="text-lg">{tree.name}</CardTitle>
                      <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 whitespace-nowrap">
                        {t("viewOnly")}
                      </span>
                    </CardHeader>
                    {tree.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{tree.description}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
```

Remove the now-unused old `trees.map(...)` / empty-state block if any remnant remains.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: clean compile, no unused-variable errors.

- [ ] **Step 5: Manual smoke test**

1. As the owner: `/trees` shows "My Trees" with your trees.
2. After a tree is shared to a second account's email (Task 4/6), log in as that account: `/trees` shows a "Shared with me" section with the tree and a "View-only" chip.

- [ ] **Step 6: Commit**

```bash
git add hooks/useTrees.ts app/(dashboard)/trees/page.tsx messages/
git commit -m "feat: show shared-with-me trees in the trees list"
```

---

### Task 6: Tree page — read-only mode + Share dialog

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`
- Modify: `messages/en.json` (+ other locales)

**Interfaces:**
- Consumes: `GET /api/trees/[treeId]` → `{ ..., role, sharedEmails? }`; share API from Task 4.
- Produces: read-only viewer experience; owner Share dialog.

- [ ] **Step 1: Add i18n strings**

In `messages/en.json` under `"tree"`, add:

```json
      "share": "Share",
      "shareTitle": "Share this tree (view-only)",
      "grantAccess": "Grant access",
      "revoke": "Revoke",
      "sharedWithNobody": "Not shared with anyone yet.",
      "emailPlaceholder": "name@example.com",
      "viewOnlyBadge": "View-only",
```

Add the same keys to any other locale files in `messages/`.

- [ ] **Step 2: Fetch the tree (role + sharedEmails) and derive read-only**

In `app/(dashboard)/trees/[treeId]/page.tsx`, add a tree fetch alongside the existing `persons`/`relationships` SWR calls (after the `relationships` useSWR, ~line 131):

```tsx
  const { data: treeMeta, mutate: mutateTree } = useSWR<ITree>(
    `/api/trees/${treeId}`,
    fetcher
  );
  const isOwner = treeMeta?.role === "owner";
  const readOnly = !!treeMeta && !isOwner;
```

Add `ITree` to the existing type import from `@/types`:

```tsx
import type { IPerson, IRelationship, RelativeRole, ITree } from "@/types";
```

- [ ] **Step 3: Gate the node mutation callbacks**

In the same file, find the `buildTreeData(...)` call (~line 428) and change the callbacks so that in read-only mode no add-relative callback is passed (the node components already hide all add buttons when `onAddRelative` is undefined). Replace the callbacks object with:

```tsx
    {
      onAddRelative: readOnly ? undefined : handleAddRelative,
      onSelect: handleSelect,
      onToggleCollapse: toggleCollapse,
      collapsedPersonIds,
    },
```

(Collapse stays enabled for viewers — it is the viewer's own readability state, not a data change.)

- [ ] **Step 4: Gate the toolbar actions and add Share button**

Find the toolbar block (~lines 444–454). Replace the `Link people` and `Add person` buttons (and add a Share button) so they only render for the owner:

```tsx
          {isOwner && (
            <>
              <Button variant="outline" onClick={() => setShareOpen(true)}>{t("share")}</Button>
              <Button variant="outline" onClick={() => setLinkOpen(true)}>{t("linkPeople")}</Button>
              <Button onClick={() => setAddPersonOpen(true)}>{t("addPerson")}</Button>
            </>
          )}
          {readOnly && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              {t("viewOnlyBadge")}
            </span>
          )}
```

Keep the existing `<TreeToolbar ... />` as-is (search/surname-filter/expand-all are view operations, fine for viewers).

- [ ] **Step 5: Add Share dialog state and handlers**

Near the other `useState` declarations (~line 167), add:

```tsx
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
```

Add these handlers (after `toggleCollapse`, ~line 218):

```tsx
  async function submitShare(e: React.FormEvent) {
    e.preventDefault();
    setShareError(null);
    setShareBusy(true);
    const res = await fetch(`/api/trees/${treeId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shareEmail }),
    });
    if (res.ok) {
      setShareEmail("");
      await mutateTree();
    } else {
      const data = await res.json().catch(() => ({}));
      setShareError(data.error ?? "Could not share");
    }
    setShareBusy(false);
  }

  async function revokeShare(email: string) {
    const res = await fetch(`/api/trees/${treeId}/shares`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) await mutateTree();
  }
```

- [ ] **Step 6: Render the Share dialog**

Add this dialog inside the returned JSX, just before the closing `</div>` of the top-level container (after the person detail dialog, ~line 736). It uses the already-imported `Dialog`, `Button`, and `Label` components plus the existing `Input` — add `import { Input } from "@/components/ui/input";` at the top if not already imported:

```tsx
      {/* Share dialog (owner only) */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("shareTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitShare} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="shareEmail">Email</Label>
              <Input
                id="shareEmail"
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                required
              />
            </div>
            <Button type="submit" disabled={shareBusy || !shareEmail}>
              {t("grantAccess")}
            </Button>
          </form>
          {shareError && <p className="text-xs text-destructive mt-1">{shareError}</p>}
          <div className="mt-4 space-y-2">
            {(treeMeta?.sharedEmails ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("sharedWithNobody")}</p>
            ) : (
              (treeMeta?.sharedEmails ?? []).map((email) => (
                <div key={email} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <span className="text-sm truncate">{email}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                    onClick={() => revokeShare(email)}
                  >
                    {t("revoke")}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 7: Make the person detail dialog read-only for viewers**

In the person detail dialog block (~lines 682–732), wrap the Edit/Delete buttons and the photo "Change photo" control so they only render for the owner. Replace the `<div className="flex gap-2 pt-2">…</div>` action block with:

```tsx
                  {isOwner && (
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" onClick={() => setEditMode(true)}>{tp("edit")}</Button>
                      <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700 hover:border-red-300" onClick={handleDeletePerson} disabled={deleting}>
                        {deleting ? tp("deleting") : tp("delete")}
                      </Button>
                    </div>
                  )}
```

And wrap the photo-change `<Button>` (the one calling `photoInputRef.current?.click()`, ~line 703) plus its file `<input>` in `{isOwner && ( … )}`.

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: clean compile.

- [ ] **Step 9: Manual smoke test — viewer read-only**

1. Owner shares the tree to a second account's email (via the Share dialog).
2. Log in as that second account; open the shared tree (from "Shared with me" or the direct `/trees/<id>` link).
3. Expected: tree renders; a "View-only" badge shows; NO Add person / Link / Share buttons; clicking a node opens detail with NO Edit/Delete/photo-change; node add-relative buttons do not appear.
4. As the owner, open the Share dialog: the viewer's email is listed; click Revoke. Reload the viewer's tab → tree no longer loads (404).

- [ ] **Step 10: Commit**

```bash
git add app/(dashboard)/trees/[treeId]/page.tsx messages/
git commit -m "feat: read-only viewer mode and Share dialog on tree page"
```

---

### Task 7: Person profile page — read-only for viewers

**Files:**
- Modify: `app/(dashboard)/person/[personId]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/trees/[treeId]` → `{ role }` (Task 3).
- Produces: viewers see the person profile without any mutation controls.

- [ ] **Step 1: Fetch role via the person's tree**

In `app/(dashboard)/person/[personId]/page.tsx`, add `ITree` to the type import:

```tsx
import type { IPerson, IEvent, IRelationship, ITree } from "@/types";
```

After the `allRels` SWR call (~line 67), add:

```tsx
  const { data: treeMeta } = useSWR<ITree>(
    person ? `/api/trees/${person.treeId}` : null,
    fetcher
  );
  const isOwner = treeMeta?.role === "owner";
```

- [ ] **Step 2: Gate the "Link person" button**

Replace the `CardHeader` of the Relationships card (~lines 206–211) with:

```tsx
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Relationships</CardTitle>
          {isOwner && (
            <Button size="sm" onClick={() => { setLinkOpen(true); setLinkPersonId(""); }}>
              Link person
            </Button>
          )}
        </CardHeader>
```

- [ ] **Step 3: Gate the unlink / divorce buttons**

In the Relationships card body, wrap each mutation control in `{isOwner && ( … )}`:
- the parents `unlink` button (~lines 228–233),
- the spouses `÷ divorce`/`edit divorce` and `unlink` buttons group (~lines 259–274),
- the children `unlink` button (~lines 292–297).

For example, the parents unlink becomes:

```tsx
                    {isOwner && (
                      <button
                        className="text-[11px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded border border-gray-200 hover:border-red-300 transition-colors"
                        onClick={() => handleUnlink(r._id)}
                      >
                        unlink
                      </button>
                    )}
```

Apply the same `{isOwner && ( … )}` wrapper to the spouses' button group (`<div className="flex gap-1 shrink-0"> … </div>`) and the children unlink button.

- [ ] **Step 4: Gate the "Add event" button**

Replace the Life Events `CardHeader` (~lines 308–311) with:

```tsx
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{tp("lifeEvents")}</CardTitle>
          {isOwner && <Button size="sm" onClick={() => setAddEventOpen(true)}>{tp("addEvent")}</Button>}
        </CardHeader>
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: clean compile.

- [ ] **Step 6: Manual smoke test**

1. As a viewer, open a person in the shared tree (`/person/<id>`).
2. Expected: no "Link person", no "unlink", no "divorce", no "Add event" controls; relationships and events still display.
3. As the owner, the same page shows all controls.

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/person/[personId]/page.tsx
git commit -m "feat: read-only person profile for shared viewers"
```

---

## Self-Review

**Spec coverage:**
- Part 1 (data model + access helper) → Tasks 1, 2.
- Part 2 (relax READ authz, strip sharedEmails, expose role) → Task 3.
- Part 3 (share grant/revoke API) → Task 4 Step 1.
- Part 4 (owner Share dialog) → Task 6 Steps 1, 5, 6.
- Part 5 (viewer read-only: tree canvas, detail, person page) → Task 6 Steps 3,4,7 + Task 7.
- Part 6 (discovery: shared-with-me list + working link) → Task 4 Step 2 + Task 5; link works via Task 3.
- Constraint "writes stay owner-only" → explicitly preserved in Task 3 (POST/PUT/DELETE untouched).
- Constraint "sharedEmails owner-only in response" → Task 3 Step 1.

**Placeholder scan:** No TBD/TODO; every code step shows complete before/after content and exact commands.

**Type consistency:** `TreeRole`, `resolveTreeAccess`, `resolvePersonAccess` signatures defined in Task 2 are used verbatim in Tasks 3–4. `ITree.role`/`ITree.sharedEmails` defined in Task 1 are consumed in Tasks 5–7. `useTrees()` return shape (`{ owned, shared, ... }`) defined in Task 5 Step 1 matches its only consumer updated in Task 5 Step 3. The shares API response `{ sharedEmails }` (Task 4) is consumed via `mutateTree()` re-fetch (the tree GET carries `sharedEmails`), so the dialog reads `treeMeta.sharedEmails` consistently.

**Note for executor:** line numbers are approximate (the tree page shifts as edits land); locate by the quoted surrounding code, not the line number.
