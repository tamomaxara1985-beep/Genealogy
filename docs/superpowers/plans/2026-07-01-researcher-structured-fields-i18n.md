# Researcher Structured Fields, Dashboard & i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the admin-assigned researcher to name/surname/email/phone/region fields, show it on the user dashboard as well as the profile, and translate its labels and region names to Georgian and Hebrew.

**Architecture:** The researcher is an embedded sub-document on `User` (unchanged storage strategy). A pure validator gates writes. Region is stored as a stable code and rendered via next-intl message lookup. Dashboard reads the researcher through the existing `/api/dashboard/stats` endpoint.

**Tech Stack:** Next.js 16 (App Router), React 19, Mongoose 9, next-intl 4, Vitest 3, shadcn/ui, TypeScript.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/components/...`, `@/types`.
- Mongoose models export with hot-reload guard: `models.X ?? model("X", Schema)`.
- Every API handler enforces auth server-side; researcher writes require `getAdminSession()` → 403.
- Region codes (exact, verbatim): `tbilisi, abkhazia, adjara, guria, imereti, kakheti, kvemo-kartli, mtskheta-mtianeti, racha-lechkhumi, samegrelo, samtskhe-javakheti, shida-kartli`.
- Supported locales: `en`, `ka` (Georgian), `he` (Hebrew). All three message files must gain the same keys.
- Tests run with `npm test` (`vitest run`).
- No data migration for old researcher docs (YAGNI).

---

### Task 1: Region data + rewritten validator

**Files:**
- Create: `lib/georgiaRegions.ts`
- Modify: `lib/researcher.ts` (full rewrite)
- Test: `lib/researcher.test.ts` (full rewrite)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `REGION_CODES: readonly RegionCode[]` and `type RegionCode` from `lib/georgiaRegions.ts`.
  - `interface ResearcherValue { name: string; surname: string; email: string; phone: string; region: string }` from `lib/researcher.ts`.
  - `validateResearcher(input: unknown): { ok: true; value: ResearcherValue } | { ok: false; error: string }` — note: **no** `today` parameter.

- [ ] **Step 1: Create the region list**

Create `lib/georgiaRegions.ts`:

```ts
export const REGION_CODES = [
  "tbilisi",
  "abkhazia",
  "adjara",
  "guria",
  "imereti",
  "kakheti",
  "kvemo-kartli",
  "mtskheta-mtianeti",
  "racha-lechkhumi",
  "samegrelo",
  "samtskhe-javakheti",
  "shida-kartli",
] as const;

export type RegionCode = (typeof REGION_CODES)[number];
```

- [ ] **Step 2: Rewrite the failing test**

Replace the entire contents of `lib/researcher.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateResearcher } from "./researcher";

const VALID = {
  name: "Jane",
  surname: "Roe",
  email: "jane@example.com",
  phone: "+995 555 12 34 56",
  region: "imereti",
};

describe("validateResearcher", () => {
  it("accepts a full valid payload", () => {
    const r = validateResearcher(VALID);
    expect(r).toEqual({ ok: true, value: VALID });
  });

  it("trims whitespace on all fields", () => {
    const r = validateResearcher({
      name: "  Jane ",
      surname: " Roe ",
      email: " jane@example.com ",
      phone: " 123 ",
      region: " imereti ",
    });
    expect(r.ok && r.value.name).toBe("Jane");
    expect(r.ok && r.value.email).toBe("jane@example.com");
    expect(r.ok && r.value.region).toBe("imereti");
  });

  it("rejects each missing required field", () => {
    for (const key of ["name", "surname", "email", "phone", "region"]) {
      const bad = { ...VALID, [key]: "  " };
      expect(validateResearcher(bad).ok).toBe(false);
    }
    expect(validateResearcher({}).ok).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(validateResearcher({ ...VALID, email: "nope" }).ok).toBe(false);
    expect(validateResearcher({ ...VALID, email: "a@" }).ok).toBe(false);
    expect(validateResearcher({ ...VALID, email: "@b.com" }).ok).toBe(false);
  });

  it("rejects a region not in the list", () => {
    expect(validateResearcher({ ...VALID, region: "narnia" }).ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- researcher`
Expected: FAIL — the current validator uses `fullName`/`contact`/`today` and the new assertions do not match.

- [ ] **Step 4: Rewrite the validator**

Replace the entire contents of `lib/researcher.ts`:

```ts
import { REGION_CODES } from "@/lib/georgiaRegions";

export interface ResearcherValue {
  name: string;
  surname: string;
  email: string;
  phone: string;
  region: string;
}

type Result =
  | { ok: true; value: ResearcherValue }
  | { ok: false; error: string };

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isEmail(v: string): boolean {
  const at = v.indexOf("@");
  return at > 0 && at < v.length - 1 && !v.includes(" ");
}

export function validateResearcher(input: unknown): Result {
  const obj = (input ?? {}) as Record<string, unknown>;

  const name = asTrimmedString(obj.name);
  const surname = asTrimmedString(obj.surname);
  const email = asTrimmedString(obj.email);
  const phone = asTrimmedString(obj.phone);
  const region = asTrimmedString(obj.region);

  if (!name) return { ok: false, error: "name is required" };
  if (!surname) return { ok: false, error: "surname is required" };
  if (!email) return { ok: false, error: "email is required" };
  if (!isEmail(email)) return { ok: false, error: "invalid email" };
  if (!phone) return { ok: false, error: "phone is required" };
  if (!region) return { ok: false, error: "region is required" };
  if (!(REGION_CODES as readonly string[]).includes(region))
    return { ok: false, error: "invalid region" };

  return { ok: true, value: { name, surname, email, phone, region } };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- researcher`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/georgiaRegions.ts lib/researcher.ts lib/researcher.test.ts
git commit -m "feat: restructure researcher validator to name/surname/email/phone/region"
```

---

### Task 2: Data model + DTO type

**Files:**
- Modify: `lib/models/User.ts:10-45`
- Modify: `types/index.ts:11-17`

**Interfaces:**
- Consumes: nothing (shape must match `ResearcherValue` from Task 1).
- Produces: `IResearcher = { name; surname; email; phone; region }` exported from `@/types`; `IUserDoc.researcher` matching shape.

- [ ] **Step 1: Update the Mongoose model**

In `lib/models/User.ts`, replace the `researcher?` field on the `IUserDoc` interface (lines 10-16):

```ts
  researcher?: {
    name: string;
    surname: string;
    email: string;
    phone: string;
    region: string;
  };
```

And replace the schema `researcher` block (lines 29-45):

```ts
    researcher: {
      type: new Schema(
        {
          name: { type: String, required: true },
          surname: { type: String, required: true },
          email: { type: String, required: true },
          phone: { type: String, required: true },
          region: { type: String, required: true },
        },
        { _id: false }
      ),
      required: false,
    },
```

- [ ] **Step 2: Update the DTO type**

In `types/index.ts`, replace the `IResearcher` interface (lines 11-17):

```ts
export interface IResearcher {
  name: string
  surname: string
  email: string
  phone: string
  region: string
}
```

- [ ] **Step 3: Verify the type-check / build compiles the models & types**

Run: `npx tsc --noEmit`
Expected: no errors originating in `lib/models/User.ts` or `types/index.ts`. (Errors in `admin/users/page.tsx`, `profile/page.tsx`, `DashboardClient.tsx` referencing old fields are expected here and fixed in later tasks.)

- [ ] **Step 4: Commit**

```bash
git add lib/models/User.ts types/index.ts
git commit -m "feat: restructure researcher sub-document and DTO"
```

---

### Task 3: Admin API — drop the date argument

**Files:**
- Modify: `app/api/admin/users/[userId]/researcher/route.ts:14-16`

**Interfaces:**
- Consumes: `validateResearcher(body)` from Task 1 (no `today` arg).
- Produces: unchanged endpoint contract (`PUT` sets researcher, `DELETE` unsets).

- [ ] **Step 1: Update the PUT handler**

In `route.ts`, replace lines 14-16:

```ts
  const body = await req.json();
  const today = new Date().toISOString().slice(0, 10);
  const result = validateResearcher(body, today);
```

with:

```ts
  const body = await req.json();
  const result = validateResearcher(body);
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors in `app/api/admin/users/[userId]/researcher/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/users/[userId]/researcher/route.ts"
git commit -m "feat: researcher PUT uses arg-free validator"
```

---

### Task 4: i18n — researcher + regions namespaces

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ka.json`
- Modify: `messages/he.json`

**Interfaces:**
- Consumes: nothing.
- Produces: message namespaces `researcher` (keys: `title, name, surname, email, phone, region, none`) and `regions` (keys = the 12 region codes) in all three locales. UI tasks depend on these keys existing.

- [ ] **Step 1: Add namespaces to `messages/en.json`**

Insert these two top-level namespaces (e.g. after the `"profile"` block; mind JSON commas):

```json
  "researcher": {
    "title": "Researcher",
    "name": "Name",
    "surname": "Surname",
    "email": "Email",
    "phone": "Phone",
    "region": "Region",
    "none": "No researcher assigned yet."
  },
  "regions": {
    "tbilisi": "Tbilisi",
    "abkhazia": "Abkhazia",
    "adjara": "Adjara",
    "guria": "Guria",
    "imereti": "Imereti",
    "kakheti": "Kakheti",
    "kvemo-kartli": "Kvemo Kartli",
    "mtskheta-mtianeti": "Mtskheta-Mtianeti",
    "racha-lechkhumi": "Racha-Lechkhumi and Kvemo Svaneti",
    "samegrelo": "Samegrelo-Zemo Svaneti",
    "samtskhe-javakheti": "Samtskhe-Javakheti",
    "shida-kartli": "Shida Kartli"
  }
```

- [ ] **Step 2: Add the same namespaces to `messages/ka.json` (Georgian)**

```json
  "researcher": {
    "title": "მკვლევარი",
    "name": "სახელი",
    "surname": "გვარი",
    "email": "ელფოსტა",
    "phone": "ტელეფონი",
    "region": "რეგიონი",
    "none": "მკვლევარი ჯერ არ არის მინიჭებული."
  },
  "regions": {
    "tbilisi": "თბილისი",
    "abkhazia": "აფხაზეთი",
    "adjara": "აჭარა",
    "guria": "გურია",
    "imereti": "იმერეთი",
    "kakheti": "კახეთი",
    "kvemo-kartli": "ქვემო ქართლი",
    "mtskheta-mtianeti": "მცხეთა-მთიანეთი",
    "racha-lechkhumi": "რაჭა-ლეჩხუმი და ქვემო სვანეთი",
    "samegrelo": "სამეგრელო-ზემო სვანეთი",
    "samtskhe-javakheti": "სამცხე-ჯავახეთი",
    "shida-kartli": "შიდა ქართლი"
  }
```

- [ ] **Step 3: Add the same namespaces to `messages/he.json` (Hebrew)**

```json
  "researcher": {
    "title": "חוקר",
    "name": "שם",
    "surname": "שם משפחה",
    "email": "דוא\"ל",
    "phone": "טלפון",
    "region": "אזור",
    "none": "טרם שובץ חוקר."
  },
  "regions": {
    "tbilisi": "טביליסי",
    "abkhazia": "אבחזיה",
    "adjara": "אג'ריה",
    "guria": "גוריה",
    "imereti": "אימרתי",
    "kakheti": "קחתי",
    "kvemo-kartli": "קוומו קרטלי",
    "mtskheta-mtianeti": "מצחתה-מתיאנתי",
    "racha-lechkhumi": "רצ'ה-לצ'חומי וקוומו סוואנתי",
    "samegrelo": "סמגרלו-זמו סוואנתי",
    "samtskhe-javakheti": "סמצחה-ג'אווחתי",
    "shida-kartli": "שידה קרטלי"
  }
```

- [ ] **Step 4: Verify all three files are valid JSON**

Run: `node -e "['en','ka','he'].forEach(l=>{const m=require('./messages/'+l+'.json'); if(!m.researcher||!m.regions||Object.keys(m.regions).length!==12) throw new Error(l+' missing keys'); }); console.log('ok')"`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/ka.json messages/he.json
git commit -m "feat: add researcher + Georgia regions i18n (en/ka/he)"
```

---

### Task 5: Admin UI — structured fields + region select

**Files:**
- Modify: `app/(dashboard)/admin/users/page.tsx`

**Interfaces:**
- Consumes: `REGION_CODES` (Task 1), `IResearcher` (Task 2), `researcher`/`regions` message namespaces (Task 4).
- Produces: admin dialog that PUTs `{ name, surname, email, phone, region }`.

- [ ] **Step 1: Fix imports**

In `app/(dashboard)/admin/users/page.tsx`:
- Remove the import line `import { RESEARCHER_STATUSES, type ResearcherStatus } from "@/lib/researcher"`.
- Remove the `Textarea` import (line 24) — no longer used.
- Add: `import { REGION_CODES } from "@/lib/georgiaRegions"`.

- [ ] **Step 2: Replace the researcher form state and handlers**

Replace the state block (lines 52-57) and `openResearcher`/`saveResearcher` (lines 59-81) with:

```tsx
  const [researcherTarget, setResearcherTarget] = useState<AdminUser | null>(null)
  const [rForm, setRForm] = useState({
    name: "", surname: "", email: "", phone: "", region: "",
  })
  const [rSaving, setRSaving] = useState(false)

  const rValid =
    rForm.name.trim() && rForm.surname.trim() && rForm.email.trim() &&
    rForm.phone.trim() && rForm.region.trim()

  function openResearcher(user: AdminUser) {
    const r = user.researcher
    setRForm({
      name: r?.name ?? "",
      surname: r?.surname ?? "",
      email: r?.email ?? "",
      phone: r?.phone ?? "",
      region: r?.region ?? "",
    })
    setResearcherTarget(user)
  }

  async function saveResearcher() {
    if (!researcherTarget || !rValid) return
    setRSaving(true)
    const res = await fetch(`/api/admin/users/${researcherTarget._id}/researcher`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rForm),
    })
    if (res.ok) { await mutate(); setResearcherTarget(null) }
    setRSaving(false)
  }
```

- [ ] **Step 3: Add translation hooks + region label helper**

After the existing `const tc = useTranslations("common")` (line 46), add:

```tsx
  const tr = useTranslations("researcher")
  const tRegions = useTranslations("regions")
```

- [ ] **Step 4: Remove the row status text**

In the action cell, delete the block (lines 158-160):

```tsx
                      {user.researcher && (
                        <span className="text-[11px] text-gray-500">{user.researcher.status}</span>
                      )}
```

Replace the button label `Researcher` (line 162) with `{tr("title")}`.

- [ ] **Step 5: Replace the dialog body**

Replace the researcher `<Dialog>` inner content (the `DialogHeader` + fields `<div>`, lines 208-243) with:

```tsx
          <DialogHeader>
            <DialogTitle>{tr("title")} — {researcherTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{tr("name")}</Label>
              <Input value={rForm.name} onChange={(e) => setRForm({ ...rForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("surname")}</Label>
              <Input value={rForm.surname} onChange={(e) => setRForm({ ...rForm, surname: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("email")}</Label>
              <Input type="email" value={rForm.email} onChange={(e) => setRForm({ ...rForm, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("phone")}</Label>
              <Input type="tel" value={rForm.phone} onChange={(e) => setRForm({ ...rForm, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("region")}</Label>
              <Select value={rForm.region} onValueChange={(v) => setRForm({ ...rForm, region: v ?? "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGION_CODES.map((c) => (
                    <SelectItem key={c} value={c}>{tRegions(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
```

- [ ] **Step 6: Update the dialog footer buttons**

Replace the footer (lines 244-254) with:

```tsx
          <DialogFooter className="gap-2">
            {researcherTarget?.researcher && (
              <Button variant="outline" onClick={unassignResearcher} disabled={rSaving} className="text-destructive hover:text-destructive mr-auto">
                {tc("delete")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setResearcherTarget(null)}>{tc("cancel")}</Button>
            <Button onClick={saveResearcher} disabled={rSaving || !rValid}>
              {rSaving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
```

- [ ] **Step 7: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in `app/(dashboard)/admin/users/page.tsx` (no unused `Textarea`, no `status`/`fullName`/`contact` references).

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/admin/users/page.tsx"
git commit -m "feat: admin researcher dialog with structured fields and region select"
```

---

### Task 6: Profile card — structured display

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

**Interfaces:**
- Consumes: `IResearcher` (Task 2), `researcher`/`regions` namespaces (Task 4).
- Produces: read-only researcher card on `/profile`.

- [ ] **Step 1: Add translation loaders**

Replace the `Promise.all` (lines 11-15) to also load the researcher + regions namespaces:

```tsx
  const [session, tNav, t, tRes, tRegions] = await Promise.all([
    auth(),
    getTranslations("nav"),
    getTranslations("profile"),
    getTranslations("researcher"),
    getTranslations("regions"),
  ]);
```

- [ ] **Step 2: Remove the now-unused Badge import**

Delete line 7: `import { Badge } from "@/components/ui/badge"`.

- [ ] **Step 3: Replace the researcher card body**

Replace the researcher `<Card className="mt-6">` block (lines 48-69) with:

```tsx
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{tRes("title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {researcher ? (
            <div className="space-y-2">
              <p className="font-medium">{researcher.name} {researcher.surname}</p>
              <p className="text-muted-foreground">{tRes("email")}: {researcher.email}</p>
              <p className="text-muted-foreground">{tRes("phone")}: {researcher.phone}</p>
              <p className="text-muted-foreground">{tRes("region")}: {tRegions(researcher.region)}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">{tRes("none")}</p>
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `app/(dashboard)/profile/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/profile/page.tsx"
git commit -m "feat: profile researcher card with structured fields and translated region"
```

---

### Task 7: Dashboard card + stats endpoint

**Files:**
- Modify: `app/api/dashboard/stats/route.ts:17-37`
- Modify: `components/dashboard/DashboardClient.tsx`

**Interfaces:**
- Consumes: `IResearcher` (Task 2), `researcher`/`regions` namespaces (Task 4).
- Produces: `/api/dashboard/stats` returns `researcher: IResearcher | null`; dashboard renders a researcher card.

- [ ] **Step 1: Extend the stats endpoint projection + payload**

In `app/api/dashboard/stats/route.ts`, change the user query (line 19) from:

```ts
    User.findById(userId).select("bio name").lean(),
```

to:

```ts
    User.findById(userId).select("bio name researcher").lean(),
```

And add `researcher` to the returned JSON (the object at lines 32-37):

```ts
  return NextResponse.json({
    treeCount: trees.length,
    personCount,
    eventCount,
    bio: user?.bio ?? "",
    researcher: user?.researcher ?? null,
  })
```

- [ ] **Step 2: Extend the Stats interface + hooks in DashboardClient**

In `components/dashboard/DashboardClient.tsx`:
- Add import: `import type { IResearcher } from "@/types"`.
- Add to the `Stats` interface (after `bio: string`):

```tsx
  researcher: IResearcher | null
```

- After `const tc = useTranslations("common")` (line 22), add:

```tsx
  const tRes = useTranslations("researcher")
  const tRegions = useTranslations("regions")
```

- [ ] **Step 3: Render the researcher card**

Immediately after the About `</Card>` (line 96) and before the `<div className="flex items-center justify-between">` trees header (line 98), insert:

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tRes("title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {data?.researcher ? (
            <div className="space-y-2">
              <p className="font-medium">{data.researcher.name} {data.researcher.surname}</p>
              <p className="text-muted-foreground">{tRes("email")}: {data.researcher.email}</p>
              <p className="text-muted-foreground">{tRes("phone")}: {data.researcher.phone}</p>
              <p className="text-muted-foreground">{tRes("region")}: {tRegions(data.researcher.region)}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">{tRes("none")}</p>
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in `app/api/dashboard/stats/route.ts` or `components/dashboard/DashboardClient.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "app/api/dashboard/stats/route.ts" "components/dashboard/DashboardClient.tsx"
git commit -m "feat: show researcher card on dashboard via stats endpoint"
```

---

### Task 8: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the test suite**

Run: `npm test`
Expected: all tests pass (includes rewritten `researcher.test.ts`).

- [ ] **Step 2: Type-check + lint the whole project**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test (documented, run by human)**

1. As admin → Admin → Users → click **Researcher** on a user. Fill name/surname/email/phone, pick a region → Save. Reopen → fields prefill; region shows selected.
2. Switch language (EN/KA/HE) via the switcher → field labels and region name change.
3. As that user → `/profile` and `/dashboard` → researcher card shows name/surname/email/phone/region.
4. Admin → researcher dialog → Unassign → user's `/profile` + `/dashboard` show "No researcher assigned yet." (translated).
5. Non-admin `PUT /api/admin/users/<id>/researcher` → 403.

No commit (verification task).
