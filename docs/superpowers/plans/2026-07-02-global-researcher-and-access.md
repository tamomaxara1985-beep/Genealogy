# Global Researcher Info + In-App Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the researcher a single global admin-managed record that every registered user can view (replacing the per-user researcher), and give all users Sidebar access to both the Researcher and Contact information, always showing the latest admin-managed data.

**Architecture:** Add a `ResearcherInfo` singleton (mirroring `ContactInfo`/`SiteSettings`) edited by admins via `GET/PUT /api/admin/researcher-info` and viewed by all users on a new `/researcher` dashboard page. Add Sidebar links to `/researcher` and the existing public `/contact`. Remove the old per-user researcher (User sub-document, its admin dialog, profile/dashboard cards, and its API route). Reuse the existing `REGION_CODES`, the `researcher`/`regions` i18n namespaces, and the existing `validateResearcher` validator.

**Tech Stack:** Next.js 16 (App Router), React 19, Mongoose 9, next-intl 4, SWR, shadcn/ui, Vitest 3, TypeScript.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/components/...`, `@/types`.
- Mongoose models export with hot-reload guard: `models.X ?? model("X", Schema)`.
- Admin API handlers gate on `getAdminSession()` (`@/lib/adminAuth`) → 403 before DB work. The user-facing `/researcher` page gates on `auth()` → `redirect("/login")` like `profile/page.tsx`.
- Researcher shape (exact, verbatim): `{ name, surname, email, phone, region }`, all strings; `region` ∈ the 12 `REGION_CODES` from `lib/georgiaRegions.ts`.
- Reuse the existing `validateResearcher(input: unknown)` from `lib/researcher.ts` (arg-free; requires all five fields, email shape, region ∈ REGION_CODES; returns `{ok:true,value} | {ok:false,error}`). Do NOT modify it or its tests.
- Locales `en`, `ka`, `he` (he = RTL). All three message files gain identical new keys.
- Do NOT use lucide brand icons. Use `Microscope` (researcher) and `Mail` (contact) — both generic and available.
- Tests run with `npm test` (`vitest run`).
- The `/contact` page already exists and is public; this plan only adds a Sidebar link to it.

---

### Task 1: ResearcherInfo model

**Files:**
- Create: `lib/models/ResearcherInfo.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ResearcherInfo` default export; `IResearcherInfoDoc` with `{ name, surname, email, phone, region: string }`.

- [ ] **Step 1: Create `lib/models/ResearcherInfo.ts`**

```ts
import { Schema, Document, models, model } from "mongoose";

export interface IResearcherInfoDoc extends Document {
  name: string;
  surname: string;
  email: string;
  phone: string;
  region: string;
  updatedAt: Date;
}

const ResearcherInfoSchema = new Schema<IResearcherInfoDoc>(
  {
    name: { type: String, default: "" },
    surname: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    region: { type: String, default: "" },
  },
  { timestamps: true }
);

export default models.ResearcherInfo ?? model<IResearcherInfoDoc>("ResearcherInfo", ResearcherInfoSchema);
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add lib/models/ResearcherInfo.ts
git commit -m "feat: add ResearcherInfo singleton model"
```

---

### Task 2: Admin researcher-info API

**Files:**
- Create: `app/api/admin/researcher-info/route.ts`

**Interfaces:**
- Consumes: `getAdminSession` (`@/lib/adminAuth`), `connectDB` (`@/lib/db`), `ResearcherInfo` (Task 1), `validateResearcher` (`@/lib/researcher`).
- Produces: `GET /api/admin/researcher-info` (info or blank default); `PUT` (validated update).

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import ResearcherInfo from "@/lib/models/ResearcherInfo";
import { validateResearcher } from "@/lib/researcher";

const BLANK = { name: "", surname: "", email: "", phone: "", region: "" };

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const info = await ResearcherInfo.findOne().lean();
  return NextResponse.json(info ?? BLANK);
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = validateResearcher(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  const info = await ResearcherInfo.findOneAndUpdate(
    {},
    { $set: result.value },
    { upsert: true, new: true }
  ).lean();
  return NextResponse.json(info);
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/researcher-info/route.ts
git commit -m "feat: admin researcher-info GET/PUT API"
```

---

### Task 3: i18n — nav + admin labels

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ka.json`
- Modify: `messages/he.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `nav.researcher`, `nav.contact`, `admin.researcher` in all three locales.

- [ ] **Step 1: `messages/en.json`**

Add to the `"nav"` namespace: `"researcher": "Researcher"` and `"contact": "Contact"`. Add to the `"admin"` namespace: `"researcher": "Researcher"`.

- [ ] **Step 2: `messages/ka.json`**

Add to `"nav"`: `"researcher": "მკვლევარი"`, `"contact": "კონტაქტი"`. Add to `"admin"`: `"researcher": "მკვლევარი"`.

- [ ] **Step 3: `messages/he.json`**

Add to `"nav"`: `"researcher": "חוקר"`, `"contact": "צור קשר"`. Add to `"admin"`: `"researcher": "חוקר"`.

- [ ] **Step 4: Verify JSON + keys**

Run:
```bash
node -e "['en','ka','he'].forEach(l=>{const m=require('./messages/'+l+'.json'); if(!m.nav.researcher||!m.nav.contact||!m.admin.researcher) throw new Error(l+' missing keys'); }); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/ka.json messages/he.json
git commit -m "feat: add researcher/contact nav + admin.researcher i18n"
```

---

### Task 4: Admin researcher page + sidebar link

**Files:**
- Create: `app/(dashboard)/admin/researcher/page.tsx`
- Modify: `components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `REGION_CODES` (`@/lib/georgiaRegions`), `researcher`/`regions`/`admin` i18n, `GET/PUT /api/admin/researcher-info` (Task 2).
- Produces: `/admin/researcher` editor; admin sidebar link.

- [ ] **Step 1: Add the AdminSidebar link**

In `components/admin/AdminSidebar.tsx`, add `Microscope` to the lucide import, and add this entry to the `links` array (after the `contact` entry):

```ts
    { href: "/admin/researcher", label: t("researcher"), icon: Microscope },
```

- [ ] **Step 2: Create `app/(dashboard)/admin/researcher/page.tsx`**

```tsx
"use client"
import { useState, useEffect } from "react"
import useSWR from "swr"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { REGION_CODES } from "@/lib/georgiaRegions"
import { Microscope } from "lucide-react"

interface Info { name: string; surname: string; email: string; phone: string; region: string }
const BLANK: Info = { name: "", surname: "", email: "", phone: "", region: "" }

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })

export default function AdminResearcherPage() {
  const t = useTranslations("admin")
  const tr = useTranslations("researcher")
  const tRegions = useTranslations("regions")
  const tc = useTranslations("common")

  const { data, mutate } = useSWR<Info>("/api/admin/researcher-info", fetcher)
  const [form, setForm] = useState<Info>(BLANK)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setForm({ ...BLANK, ...data })
  }, [data])

  const valid =
    form.name.trim() && form.surname.trim() && form.email.trim() &&
    form.phone.trim() && form.region.trim()

  function set(k: keyof Info, v: string) { setForm((f) => ({ ...f, [k]: v })); setSaved(false) }

  async function save() {
    if (!valid) return
    setSaving(true)
    const res = await fetch("/api/admin/researcher-info", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) { await mutate(); setSaved(true) }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Microscope className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">{t("researcher")}</h1>
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{tr("name")}</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("surname")}</Label>
            <Input value={form.surname} onChange={(e) => set("surname", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("email")}</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("phone")}</Label>
            <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{tr("region")}</Label>
          <Select value={form.region} onValueChange={(v) => set("region", v ?? "")}>
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
          {saved && <span className="text-sm text-green-600">{t("savedTheme")}</span>}
        </div>
      </div>
    </div>
  )
}
```

(`admin.savedTheme` = "Saved" already exists in all three locales — reused here for the saved indicator rather than adding a new key.)

- [ ] **Step 3: Verify type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in the new page or `AdminSidebar.tsx`. (Pre-existing `react-hooks/set-state-in-effect` in DashboardClient.tsx is unrelated.)

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/admin/researcher/page.tsx" components/admin/AdminSidebar.tsx
git commit -m "feat: admin researcher-info editor page + sidebar link"
```

---

### Task 5: User /researcher view page

**Files:**
- Create: `app/(dashboard)/researcher/page.tsx`

**Interfaces:**
- Consumes: `ResearcherInfo` (Task 1), `researcher`/`regions` i18n, `auth` (`@/lib/auth`).
- Produces: `/researcher` page for any logged-in user.

- [ ] **Step 1: Create the page**

```tsx
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/db"
import ResearcherInfo from "@/lib/models/ResearcherInfo"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Info { name: string; surname: string; email: string; phone: string; region: string }

export default async function ResearcherPage() {
  const [session, tNav, tr, tRegions] = await Promise.all([
    auth(),
    getTranslations("nav"),
    getTranslations("researcher"),
    getTranslations("regions"),
  ])
  if (!session?.user) redirect("/login")

  await connectDB()
  const info = await ResearcherInfo.findOne().lean<Info | null>()
  const has = info && info.name

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{tNav("researcher")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{tr("title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {has ? (
            <div className="space-y-2">
              <p className="font-medium">{info!.name} {info!.surname}</p>
              {info!.email && (
                <p className="text-muted-foreground">
                  {tr("email")}: <a href={`mailto:${info!.email}`} className="hover:underline">{info!.email}</a>
                </p>
              )}
              {info!.phone && (
                <p className="text-muted-foreground">
                  {tr("phone")}: <a href={`tel:${info!.phone}`} className="hover:underline">{info!.phone}</a>
                </p>
              )}
              {info!.region && (
                <p className="text-muted-foreground">{tr("region")}: {tRegions(info!.region)}</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">{tr("none")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/researcher/page.tsx"
git commit -m "feat: user-facing /researcher page showing global researcher"
```

---

### Task 6: Sidebar links (Researcher + Contact)

**Files:**
- Modify: `components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `nav.researcher`, `nav.contact` (Task 3).
- Produces: Sidebar links for all users.

- [ ] **Step 1: Update the Sidebar**

In `components/layout/Sidebar.tsx`, add `Microscope` and `Mail` to the lucide import line (currently `import { Home, Trees, User, Dna, ShieldCheck } from "lucide-react";`):

```ts
import { Home, Trees, User, Dna, ShieldCheck, Microscope, Mail } from "lucide-react";
```

Add two entries to the `nav` array, after the `profile` entry:

```ts
    { href: "/researcher", label: t("researcher"), icon: Microscope },
    { href: "/contact", label: t("contact"), icon: Mail },
```

- [ ] **Step 2: Verify type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in `Sidebar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: add Researcher + Contact links to dashboard sidebar"
```

---

### Task 7: Remove the per-user researcher

**Files:**
- Modify: `lib/models/User.ts`
- Delete: `app/api/admin/users/[userId]/researcher/route.ts`
- Modify: `app/(dashboard)/admin/users/page.tsx`
- Modify: `app/(dashboard)/profile/page.tsx`
- Modify: `components/dashboard/DashboardClient.tsx`
- Modify: `app/api/dashboard/stats/route.ts`
- Modify: `types/index.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `IUser` no longer has `researcher`; `User` model has no `researcher` sub-doc. `IResearcher` type stays exported (reused by ResearcherInfo consumers).

- [ ] **Step 1: Remove the `researcher` sub-doc from `lib/models/User.ts`**

Delete the `researcher?: {...}` block from `IUserDoc` (lines 10-16) and the `researcher: { type: new Schema(...), required: false }` block from the schema (lines 29-41). The file becomes:

```ts
import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  role: "user" | "admin";
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    image: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    bio: { type: String },
  },
  { timestamps: true }
);

export default models.User ?? model<IUserDoc>("User", UserSchema);
```

(Note: `mongoose` default import is currently unused and pre-existing — leave the import line as-is to avoid churn; it does not error, only a pre-existing lint warning.)

- [ ] **Step 2: Delete the per-user researcher API route**

```bash
git rm "app/api/admin/users/[userId]/researcher/route.ts"
```

If the `researcher` directory is now empty, git will drop it automatically.

- [ ] **Step 3: Revert `app/(dashboard)/admin/users/page.tsx` to remove all researcher UI**

Replace the ENTIRE file with:

```tsx
// app/(dashboard)/admin/users/page.tsx
"use client"
import { useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Users, Trash2 } from "lucide-react"

interface AdminUser {
  _id: string
  name: string
  email: string
  role: "user" | "admin"
  createdAt: string
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`)
    return r.json()
  })

export default function AdminUsersPage() {
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const { data: session } = useSession()
  const { data: users = [], mutate } = useSWR<AdminUser[]>("/api/admin/users", fetcher)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRoleChange(userId: string, role: string | null) {
    if (!role) return
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    if (res.ok) mutate()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setLoading(true)
    const res = await fetch(`/api/admin/users/${deleteTarget._id}`, { method: "DELETE" })
    if (res.ok) {
      await mutate()
      setDeleteTarget(null)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">{t("users")} ({users.length})</h1>
      </div>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("name")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("email")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("role")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("joined")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user._id === session?.user?.id
              return (
                <tr key={user._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.role}
                      onValueChange={(role) => handleRoleChange(user._id, role)}
                      disabled={isSelf}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{t("roleUser")}</SelectItem>
                        <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSelf}
                      onClick={() => setDeleteTarget(user)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm">
                  {t("noUsers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteUser")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("deleteUserDesc", { name: deleteTarget?.name ?? "" })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{tc("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? tc("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 4: Remove the researcher card from `app/(dashboard)/profile/page.tsx`**

Replace the ENTIRE file with:

```tsx
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  const [session, tNav, t] = await Promise.all([
    auth(),
    getTranslations("nav"),
    getTranslations("profile"),
  ]);
  if (!session?.user) redirect("/login");

  const initials = session.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "U";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{tNav("profile")}</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 text-xl font-bold">
              {initials}
            </div>
            <div>
              <CardTitle>{session.user.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("memberSince")}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Remove the researcher card from `components/dashboard/DashboardClient.tsx`**

Make these edits:
- Delete the import line `import type { IResearcher } from "@/types"`.
- In the `Stats` interface, delete the line `researcher: IResearcher | null`.
- Delete the two hook lines `const tRes = useTranslations("researcher")` and `const tRegions = useTranslations("regions")`.
- Delete the entire researcher `<Card>` block (the one whose title is `{tRes("title")}`, spanning from `<Card>` after the About card's closing `</Card>` down to its matching `</Card>`, i.e. the block rendering `data?.researcher`).

The trees-header `<div>` must directly follow the About `</Card>`.

- [ ] **Step 6: Remove researcher from `app/api/dashboard/stats/route.ts`**

- Change the user query `.select("bio name researcher")` back to `.select("bio name")`.
- Delete the line `researcher: user?.researcher ?? null,` from the returned JSON object.

- [ ] **Step 7: Drop `IUser.researcher` in `types/index.ts`**

In the `IUser` interface, delete the line `researcher?: IResearcher`. KEEP the `IResearcher` interface exported (it is reused as the ResearcherInfo shape).

- [ ] **Step 8: Verify type-check + lint + tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no type errors; no NEW lint errors (only the pre-existing `set-state-in-effect` at DashboardClient.tsx:34); all tests pass (the reused `lib/researcher.test.ts` stays green). Grep to confirm no stray references: `grep -rn "\.researcher" app components --include=*.tsx --include=*.ts | grep -iv researcherinfo` should return nothing meaningful (only the new researcher-info page/API which reference the model, not `user.researcher`).

- [ ] **Step 9: Commit**

```bash
git add lib/models/User.ts "app/(dashboard)/admin/users/page.tsx" "app/(dashboard)/profile/page.tsx" components/dashboard/DashboardClient.tsx app/api/dashboard/stats/route.ts types/index.ts
git commit -m "refactor: remove per-user researcher (replaced by global ResearcherInfo)"
```

---

### Task 8: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the test suite**

Run: `npm test`
Expected: all tests pass (28 tests, including the reused `lib/researcher.test.ts` and `lib/contact.test.ts`).

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; the only lint error is the pre-existing `react-hooks/set-state-in-effect` at `components/dashboard/DashboardClient.tsx:34`.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/researcher`, `/admin/researcher`, and `/api/admin/researcher-info` appear in the route list; `/api/admin/users/[userId]/researcher` does NOT.

- [ ] **Step 4: Manual smoke test (documented, run by human)**

1. As admin → Admin → Researcher → fill name/surname/email/phone, pick a region → Save.
2. As any user (incl. non-admin) → Sidebar → Researcher → see the same info; region name matches locale (EN/KA/HE); in HE the layout is RTL.
3. Sidebar → Contact → the `/contact` page loads with the latest contact info.
4. Confirm the old per-user researcher is gone: Admin → Users has no Researcher column/button; `/profile` and `/dashboard` show no researcher card.
5. Non-admin `PUT /api/admin/researcher-info` → 403.

No commit (verification task).
