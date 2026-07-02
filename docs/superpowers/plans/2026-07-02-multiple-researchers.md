# Multiple Researchers + Multilingual Names + "Georgia" Region Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single global researcher with an admin-managed list of researchers whose names/surnames are stored per-language (en/ka/he) and displayed in the viewer's locale, and add a whole-country "Georgia" region option.

**Architecture:** Rename the `ResearcherInfo` single-doc model to a `Researcher` collection. Names become `{en,ka,he}` subdocuments displayed with English fallback. Single-doc GET/PUT route becomes collection CRUD (admin) plus a read-only user list route. Admin page becomes list+editor; user page becomes a card grid. A one-off script migrates the existing doc.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Mongoose 9, next-intl, SWR, shadcn/ui.

## Global Constraints

- Next.js 16 App Router — read `node_modules/next/dist/docs/` before writing Next.js code; APIs differ from training data.
- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/components/...`, `@/types`.
- Every API handler authenticates manually: admin routes via `getAdminSession()` → 403; user routes via `await auth()` → 401. No middleware guard.
- Mongoose models use hot-reload guard: `models.X ?? model("X", Schema)`.
- Locales: `en`, `ka` (Georgian), `he` (Hebrew). All three `messages/*.json` must stay key-parallel.
- No test runner exists. Verification = `npm run lint`, `npm run build`, and manual `npm run dev` checks. Do NOT add a test framework.
- Amber color scheme (`amber-*` / `#f59e0b`). Compose classes with `cn()`.
- Display rule everywhere: `name[locale] || name.en` (same for surname).
- Region label rendering: `tRegions(code)` — unchanged pattern.
- Commit after each task.

---

### Task 1: Add "Georgia" region code + i18n labels

**Files:**
- Modify: `lib/georgiaRegions.ts:1-14`
- Modify: `messages/en.json:239-252` (regions block)
- Modify: `messages/ka.json` (regions block)
- Modify: `messages/he.json` (regions block)

**Interfaces:**
- Consumes: nothing.
- Produces: `"georgia"` added to `REGION_CODES` (still `as const`, so `RegionCode` union now includes `"georgia"`). `regions.georgia` label key present in all three locale files.

- [ ] **Step 1: Add the code (first position) in `lib/georgiaRegions.ts`**

```ts
export const REGION_CODES = [
  "georgia",
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

- [ ] **Step 2: Add label to `messages/en.json` regions block**

Add as the first key inside `"regions": { ... }`:
```json
    "georgia": "Georgia",
```

- [ ] **Step 3: Add label to `messages/ka.json` regions block**

Find the `"regions"` object and add as its first key:
```json
    "georgia": "საქართველო",
```

- [ ] **Step 4: Add label to `messages/he.json` regions block**

Find the `"regions"` object and add as its first key (this is the country Georgia, not ג'ורג'יה which reads as the US state / name George):
```json
    "georgia": "גאורגיה",
```

- [ ] **Step 5: Verify lint + JSON validity**

Run: `npm run lint`
Expected: no errors. If any `*.json` fails to parse, the lint/build step will report it.

- [ ] **Step 6: Commit**

```bash
git add lib/georgiaRegions.ts messages/en.json messages/ka.json messages/he.json
git commit -m "feat: add Georgia (whole country) region option"
```

---

### Task 2: Researcher model with localized name/surname

**Files:**
- Create: `lib/models/Researcher.ts`
- Delete: `lib/models/ResearcherInfo.ts` (after Task 6 & 7 stop importing it — see note)

**Interfaces:**
- Consumes: nothing.
- Produces: default export `Researcher` (Mongoose model, collection `researchers`); exported interface `IResearcherDoc` with `name: {en,ka,he}`, `surname: {en,ka,he}`, `email`, `phone`, `region`, `createdAt`, `updatedAt`.

> **Note on deletion:** Do not delete `ResearcherInfo.ts` in this task — it is still imported by the old route and pages until Tasks 5–7. Create the new model now; delete the old file in Task 8.

- [ ] **Step 1: Create `lib/models/Researcher.ts`**

```ts
import { Schema, Document, models, model } from "mongoose";

interface LocalizedName {
  en: string;
  ka: string;
  he: string;
}

export interface IResearcherDoc extends Document {
  name: LocalizedName;
  surname: LocalizedName;
  email: string;
  phone: string;
  region: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocalizedNameSchema = new Schema<LocalizedName>(
  {
    en: { type: String, default: "" },
    ka: { type: String, default: "" },
    he: { type: String, default: "" },
  },
  { _id: false }
);

const ResearcherSchema = new Schema<IResearcherDoc>(
  {
    name: { type: LocalizedNameSchema, default: () => ({}) },
    surname: { type: LocalizedNameSchema, default: () => ({}) },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    region: { type: String, default: "" },
  },
  { timestamps: true }
);

export default models.Researcher ?? model<IResearcherDoc>("Researcher", ResearcherSchema);
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `lib/models/Researcher.ts`. (Pre-existing errors elsewhere, if any, are unrelated.)

- [ ] **Step 3: Commit**

```bash
git add lib/models/Researcher.ts
git commit -m "feat: add Researcher model with localized name/surname"
```

---

### Task 3: Update validation for localized shape

**Files:**
- Modify: `lib/researcher.ts` (whole file)

**Interfaces:**
- Consumes: `REGION_CODES` from `@/lib/georgiaRegions` (now includes `"georgia"`).
- Produces: `interface LocalizedName { en: string; ka: string; he: string }`; `interface ResearcherValue { name: LocalizedName; surname: LocalizedName; email: string; phone: string; region: string }`; `validateResearcher(input: unknown): { ok: true; value: ResearcherValue } | { ok: false; error: string }`. Requires `name.en` and `surname.en` non-empty; `ka`/`he` optional; `email` valid; `phone` non-empty; `region` ∈ `REGION_CODES`.

- [ ] **Step 1: Rewrite `lib/researcher.ts`**

```ts
import { REGION_CODES } from "@/lib/georgiaRegions";

export interface LocalizedName {
  en: string;
  ka: string;
  he: string;
}

export interface ResearcherValue {
  name: LocalizedName;
  surname: LocalizedName;
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

function localized(v: unknown): LocalizedName {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    en: asTrimmedString(o.en),
    ka: asTrimmedString(o.ka),
    he: asTrimmedString(o.he),
  };
}

function isEmail(v: string): boolean {
  const at = v.indexOf("@");
  return at > 0 && at < v.length - 1 && !v.includes(" ");
}

export function validateResearcher(input: unknown): Result {
  const obj = (input ?? {}) as Record<string, unknown>;

  const name = localized(obj.name);
  const surname = localized(obj.surname);
  const email = asTrimmedString(obj.email);
  const phone = asTrimmedString(obj.phone);
  const region = asTrimmedString(obj.region);

  if (!name.en) return { ok: false, error: "name (English) is required" };
  if (!surname.en) return { ok: false, error: "surname (English) is required" };
  if (!email) return { ok: false, error: "email is required" };
  if (!isEmail(email)) return { ok: false, error: "invalid email" };
  if (!phone) return { ok: false, error: "phone is required" };
  if (!region) return { ok: false, error: "region is required" };
  if (!(REGION_CODES as readonly string[]).includes(region))
    return { ok: false, error: "invalid region" };

  return { ok: true, value: { name, surname, email, phone, region } };
}
```

- [ ] **Step 2: Verify types** (runtime behavior is covered by the manual API checks in Task 5 Step 5 — no test runner exists)

Run: `npx tsc --noEmit`
Expected: no new errors in `lib/researcher.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/researcher.ts
git commit -m "feat: validate localized researcher name/surname"
```

---

### Task 4: Update DTO type

**Files:**
- Modify: `types/index.ts:10-16`

**Interfaces:**
- Consumes: nothing.
- Produces: updated `IResearcher` with `_id: string`, `name: {en,ka,he}`, `surname: {en,ka,he}`, `email`, `phone`, `region`.

- [ ] **Step 1: Replace the `IResearcher` interface**

```ts
export interface ILocalizedName {
  en: string
  ka: string
  he: string
}

export interface IResearcher {
  _id: string
  name: ILocalizedName
  surname: ILocalizedName
  email: string
  phone: string
  region: string
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: errors will now appear in the OLD admin/user pages and route that still use the string shape — that is expected; Tasks 5–7 fix them. No error should originate in `types/index.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: localized IResearcher DTO"
```

---

### Task 5: Collection CRUD API routes

**Files:**
- Create: `app/api/admin/researchers/route.ts` (GET list, POST create)
- Create: `app/api/admin/researchers/[id]/route.ts` (PUT update, DELETE)
- Create: `app/api/researchers/route.ts` (GET list for authed users)

**Interfaces:**
- Consumes: `Researcher` model (Task 2), `validateResearcher` (Task 3), `getAdminSession` from `@/lib/adminAuth`, `auth` from `@/lib/auth`, `connectDB` from `@/lib/db`.
- Produces: HTTP endpoints per the spec table. Admin GET returns `IResearcherDoc[]` sorted `createdAt` asc; POST returns created doc; PUT returns updated doc or 404; DELETE returns `{ ok: true }` or 404; user GET returns the same list.

- [ ] **Step 1: Create `app/api/admin/researchers/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import Researcher from "@/lib/models/Researcher";
import { validateResearcher } from "@/lib/researcher";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const list = await Researcher.find().sort({ createdAt: 1 }).lean();
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = validateResearcher(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  const doc = await Researcher.create(result.value);
  return NextResponse.json(doc, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/admin/researchers/[id]/route.ts`**

> Next.js 16: route context `params` is a Promise — `await` it. Confirm against `node_modules/next/dist/docs/` if unsure.

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import Researcher from "@/lib/models/Researcher";
import { validateResearcher } from "@/lib/researcher";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = validateResearcher(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  const doc = await Researcher.findByIdAndUpdate(
    id,
    { $set: result.value },
    { new: true }
  ).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectDB();
  const doc = await Researcher.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `app/api/researchers/route.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Researcher from "@/lib/models/Researcher";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const list = await Researcher.find().sort({ createdAt: 1 }).lean();
  return NextResponse.json(list);
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no new errors in the three new route files.

- [ ] **Step 5: Manual smoke test (dev server)**

Run: `npm run dev`, log in as admin, then in the browser console or via curl with your session cookie:
- `POST /api/admin/researchers` with `{"name":{"en":"Ana"},"surname":{"en":"Test"},"email":"a@b.com","phone":"123","region":"georgia"}` → 201.
- Same POST with `name.en` empty → 400 `"name (English) is required"`.
- Same POST with `"region":"nope"` → 400 `"invalid region"`.
- `GET /api/admin/researchers` → array including the created doc.
Expected: statuses as noted.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/researchers app/api/researchers
git commit -m "feat: researcher collection CRUD + user list API"
```

---

### Task 6: Admin page — list + multilingual editor

**Files:**
- Modify: `app/(dashboard)/admin/researcher/page.tsx` (full rewrite)
- Modify: `messages/en.json`, `messages/ka.json`, `messages/he.json` (add name sub-labels under `researcher`)

**Interfaces:**
- Consumes: `/api/admin/researchers` (Task 5), `REGION_CODES`, `useLocale`/`useTranslations` from next-intl, `IResearcher`/`ILocalizedName` (Task 4).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Add name sub-labels to `messages/en.json` `researcher` block**

Add these keys inside `"researcher": { ... }`:
```json
    "nameEn": "Name (English)",
    "nameKa": "Name (Georgian)",
    "nameHe": "Name (Hebrew)",
    "surnameEn": "Surname (English)",
    "surnameKa": "Surname (Georgian)",
    "surnameHe": "Surname (Hebrew)",
    "delete": "Delete researcher?"
```

- [ ] **Step 2: Add the same keys to `messages/ka.json` `researcher` block**

```json
    "nameEn": "სახელი (ინგლისური)",
    "nameKa": "სახელი (ქართული)",
    "nameHe": "სახელი (ებრაული)",
    "surnameEn": "გვარი (ინგლისური)",
    "surnameKa": "გვარი (ქართული)",
    "surnameHe": "გვარი (ებრაული)",
    "delete": "წაიშალოს მკვლევარი?"
```

- [ ] **Step 3: Add the same keys to `messages/he.json` `researcher` block**

```json
    "nameEn": "שם (אנגלית)",
    "nameKa": "שם (גאורגית)",
    "nameHe": "שם (עברית)",
    "surnameEn": "שם משפחה (אנגלית)",
    "surnameKa": "שם משפחה (גאורגית)",
    "surnameHe": "שם משפחה (עברית)",
    "delete": "למחוק את החוקר?"
```

- [ ] **Step 4: Rewrite `app/(dashboard)/admin/researcher/page.tsx`**

```tsx
"use client"
import { useState } from "react"
import useSWR from "swr"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { REGION_CODES } from "@/lib/georgiaRegions"
import { Microscope, Trash2, Pencil } from "lucide-react"
import type { IResearcher, ILocalizedName } from "@/types"

type Form = {
  _id?: string
  name: ILocalizedName
  surname: ILocalizedName
  email: string
  phone: string
  region: string
}
const EMPTY_NAME: ILocalizedName = { en: "", ka: "", he: "" }
const BLANK: Form = { name: { ...EMPTY_NAME }, surname: { ...EMPTY_NAME }, email: "", phone: "", region: "" }

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })

export default function AdminResearcherPage() {
  const t = useTranslations("admin")
  const tr = useTranslations("researcher")
  const tRegions = useTranslations("regions")
  const tc = useTranslations("common")
  const locale = useLocale() as keyof ILocalizedName

  const { data: list = [], mutate } = useSWR<IResearcher[]>("/api/admin/researchers", fetcher)
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)

  const valid = !!form &&
    form.name.en.trim() && form.surname.en.trim() && form.email.trim() &&
    form.phone.trim() && form.region.trim()

  function setField(k: "email" | "phone" | "region", v: string) {
    setForm((f) => (f ? { ...f, [k]: v } : f))
  }
  function setLoc(field: "name" | "surname", lang: keyof ILocalizedName, v: string) {
    setForm((f) => (f ? { ...f, [field]: { ...f[field], [lang]: v } } : f))
  }

  async function save() {
    if (!form || !valid) return
    setSaving(true)
    const isEdit = !!form._id
    const url = isEdit ? `/api/admin/researchers/${form._id}` : "/api/admin/researchers"
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) { await mutate(); setForm(null) }
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm(tr("delete"))) return
    const res = await fetch(`/api/admin/researchers/${id}`, { method: "DELETE" })
    if (res.ok) await mutate()
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Microscope className="h-5 w-5 text-amber-500" />
          <h1 className="text-xl font-bold">{t("researcher")}</h1>
        </div>
        {!form && (
          <Button onClick={() => setForm({ ...BLANK, name: { ...EMPTY_NAME }, surname: { ...EMPTY_NAME } })}
            className="bg-amber-500 hover:bg-amber-600 text-white">
            {tr("add")}
          </Button>
        )}
      </div>

      {!form && (
        <div className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{tr("none")}</p>}
          {list.map((r) => (
            <div key={r._id} className="flex items-center justify-between rounded-md border p-3">
              <div className="text-sm">
                <p className="font-medium">
                  {(r.name[locale] || r.name.en)} {(r.surname[locale] || r.surname.en)}
                </p>
                <p className="text-muted-foreground">{tRegions(r.region)} · {r.email}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => setForm({ _id: r._id, name: { ...EMPTY_NAME, ...r.name }, surname: { ...EMPTY_NAME, ...r.surname }, email: r.email, phone: r.phone, region: r.region })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => del(r._id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="space-y-4 rounded-md border p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{tr("nameEn")}</Label>
              <Input value={form.name.en} onChange={(e) => setLoc("name", "en", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("nameKa")}</Label>
              <Input value={form.name.ka} onChange={(e) => setLoc("name", "ka", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("nameHe")}</Label>
              <Input value={form.name.he} onChange={(e) => setLoc("name", "he", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("surnameEn")}</Label>
              <Input value={form.surname.en} onChange={(e) => setLoc("surname", "en", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("surnameKa")}</Label>
              <Input value={form.surname.ka} onChange={(e) => setLoc("surname", "ka", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("surnameHe")}</Label>
              <Input value={form.surname.he} onChange={(e) => setLoc("surname", "he", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{tr("email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("phone")}</Label>
              <Input type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{tr("region")}</Label>
            <Select value={form.region} onValueChange={(v) => setField("region", v ?? "")}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REGION_CODES.map((c) => (
                  <SelectItem key={c} value={c}>{tRegions(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving || !valid} className="bg-amber-500 hover:bg-amber-600 text-white">
              {saving ? tc("saving") : tc("save")}
            </Button>
            <Button variant="outline" onClick={() => setForm(null)}>{tc("cancel")}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in the admin page.

- [ ] **Step 6: Manual check**

Run: `npm run dev`, go to `/admin/researcher`. Add a researcher with all three name languages + region "Georgia" → appears in list. Edit it → values pre-fill. Delete → confirm → row removed.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/admin/researcher/page.tsx" messages/en.json messages/ka.json messages/he.json
git commit -m "feat: admin list + multilingual researcher editor"
```

---

### Task 7: User page — localized card grid

**Files:**
- Modify: `app/(dashboard)/researcher/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Researcher` model (Task 2), `getLocale`/`getTranslations` from `next-intl/server`, `ILocalizedName` (Task 4).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Rewrite `app/(dashboard)/researcher/page.tsx`**

```tsx
import { getTranslations, getLocale } from "next-intl/server"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/db"
import Researcher from "@/lib/models/Researcher"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ILocalizedName } from "@/types"

interface Row {
  _id: string
  name: ILocalizedName
  surname: ILocalizedName
  email: string
  phone: string
  region: string
}

export default async function ResearcherPage() {
  const [session, locale, tNav, tr, tRegions] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("researcher"),
    getTranslations("regions"),
  ])
  if (!session?.user) redirect("/login")

  await connectDB()
  const list = await Researcher.find().sort({ createdAt: 1 }).lean<Row[]>()
  const lang = locale as keyof ILocalizedName

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{tNav("researcher")}</h1>
      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">{tr("none")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((r) => (
            <Card key={r._id}>
              <CardHeader>
                <CardTitle>{(r.name[lang] || r.name.en)} {(r.surname[lang] || r.surname.en)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {r.email && (
                  <p className="text-muted-foreground">
                    {tr("email")}: <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
                  </p>
                )}
                {r.phone && (
                  <p className="text-muted-foreground">
                    {tr("phone")}: <a href={`tel:${r.phone}`} className="hover:underline">{r.phone}</a>
                  </p>
                )}
                {r.region && (
                  <p className="text-muted-foreground">{tr("region")}: {tRegions(r.region)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual check across locales**

Run: `npm run dev`, visit `/researcher`. With researchers added in Task 6, switch UI locale (existing switcher) to ka and he: names render in that language, falling back to English where ka/he were left blank; region label localizes; "Georgia" shows as საქართველო / גאורגיה.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/researcher/page.tsx"
git commit -m "feat: user researcher page shows all researchers, localized"
```

---

### Task 8: Migrate existing doc + remove old model/route

**Files:**
- Create: `scripts/migrate-researchers.mjs`
- Delete: `lib/models/ResearcherInfo.ts`
- Delete: `app/api/admin/researcher-info/route.ts`

**Interfaces:**
- Consumes: `MONGODB_URI`, the old `researcherinfos` collection.
- Produces: migrated document(s) in `researchers`.

- [ ] **Step 1: Confirm nothing still imports the old model/route**

Run: `git grep -n "ResearcherInfo\|researcher-info"`
Expected: only matches in `lib/models/ResearcherInfo.ts` and `app/api/admin/researcher-info/route.ts` (the files being deleted) and this plan/spec. If any live source file still imports them, fix that import first.

- [ ] **Step 2: Create `scripts/migrate-researchers.mjs`**

```js
// One-off: copy the single legacy researcherinfos doc into the researchers collection.
// Run once:  node scripts/migrate-researchers.mjs
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }

await mongoose.connect(uri);
const db = mongoose.connection.db;

const old = await db.collection("researcherinfos").findOne({});
if (!old) { console.log("No legacy researcher doc found. Nothing to migrate."); await mongoose.disconnect(); process.exit(0); }

const existing = await db.collection("researchers").findOne({ email: old.email });
if (existing) { console.log(`Already migrated (email ${old.email}). Skipping.`); await mongoose.disconnect(); process.exit(0); }

const now = new Date();
const doc = {
  name: { en: old.name ?? "", ka: "", he: "" },
  surname: { en: old.surname ?? "", ka: "", he: "" },
  email: old.email ?? "",
  phone: old.phone ?? "",
  region: old.region ?? "",
  createdAt: now,
  updatedAt: now,
};
const res = await db.collection("researchers").insertOne(doc);
console.log(`Migrated legacy researcher -> researchers/${res.insertedId}`);
await mongoose.disconnect();
```

- [ ] **Step 3: Run the migration (requires `.env.local` MONGODB_URI in the shell env)**

Run (PowerShell): `node -r dotenv/config scripts/migrate-researchers.mjs dotenv_config_path=.env.local`
(If `dotenv` is not a dependency, instead set the var inline: `$env:MONGODB_URI = (Get-Content .env.local | Select-String '^MONGODB_URI=' ).ToString().Split('=',2)[1]; node scripts/migrate-researchers.mjs`)
Expected: `Migrated legacy researcher -> researchers/<id>` or `No legacy researcher doc found.`

- [ ] **Step 4: Delete the old model and route**

```bash
git rm lib/models/ResearcherInfo.ts app/api/admin/researcher-info/route.ts
```

- [ ] **Step 5: Verify build is clean end-to-end**

Run: `npm run lint && npm run build`
Expected: build succeeds, no references to the removed files.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-researchers.mjs
git commit -m "chore: migrate legacy researcher doc; remove single-doc model + route"
```

---

## Self-Review

**Spec coverage:**
- Many researchers → Tasks 2,5,6,7 ✓
- Multilingual name/surname (en/ka/he, manual, en-fallback display) → Tasks 2,3,4,6,7 ✓
- "Georgia" region option → Task 1 ✓
- Collection CRUD + user list API → Task 5 ✓
- Admin list + editor → Task 6 ✓
- User card grid → Task 7 ✓
- Migration of existing doc → Task 8 ✓
- Delete old route/model → Task 8 ✓
- i18n keys (regions.georgia + name sub-labels) → Tasks 1,6 ✓

**Placeholder scan:** No TBD/TODO. Task 3 Step 2 explicitly discards the non-runnable scratch idea and routes verification to tsc + Task 5 manual checks — no dangling placeholder. Every code step shows full code.

**Type consistency:** `ILocalizedName {en,ka,he}` used in types (Task 4), consumed in admin (Task 6) and user (Task 7). `ResearcherValue`/`validateResearcher` signature (Task 3) matches route usage (Task 5). Model export name `Researcher` consistent across Tasks 2,5,7,8. `IResearcher` includes `_id` used by admin list keys/edit.
