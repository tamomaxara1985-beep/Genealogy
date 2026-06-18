# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full admin panel at `/admin` with sub-routes for charts dashboard, theme editor, content editor, and collections CRUD browser.

**Architecture:** Sub-route admin shell (`app/(dashboard)/admin/` with its own sidebar) extending the existing admin layout. Theme stored in `SiteSettings` MongoDB collection and injected as CSS custom properties in `app/layout.tsx`. UI string overrides stored in `SiteContent` collection and merged with next-intl messages at request time. Collections CRUD exposes a generic table browser for the 5 registered Mongoose models.

**Tech Stack:** Next.js 16 App Router, Mongoose 9, shadcn/ui + recharts (chart), culori (color conversion), next-intl, Tailwind CSS v4

---

## File Map

**New models:**
- `lib/models/SiteSettings.ts` — singleton theme config
- `lib/models/SiteContent.ts` — per-locale UI string overrides

**New utilities:**
- `lib/colorUtils.ts` — hex↔oklch conversion via culori
- `lib/siteSettings.ts` — getSiteSettings (cached), buildThemeStyle, getFontUrl
- `lib/siteContent.ts` — getSiteContent, applyContentOverrides

**Modified:**
- `app/layout.tsx` — inject theme style + font + content merge
- `app/(dashboard)/admin/layout.tsx` — add AdminSidebar
- `app/(dashboard)/admin/page.tsx` — replace with redirect to /admin/dashboard
- `messages/en.json`, `messages/he.json`, `messages/ka.json` — add new admin keys

**New API routes:**
- `app/api/admin/stats/route.ts`
- `app/api/admin/settings/route.ts`
- `app/api/admin/content/route.ts`
- `app/api/admin/content/[id]/route.ts`
- `app/api/admin/collections/route.ts`
- `app/api/admin/collections/[name]/route.ts`
- `app/api/admin/collections/[name]/[id]/route.ts`

**New admin pages:**
- `app/(dashboard)/admin/dashboard/page.tsx`
- `app/(dashboard)/admin/theme/page.tsx`
- `app/(dashboard)/admin/content/page.tsx`
- `app/(dashboard)/admin/collections/page.tsx`
- `app/(dashboard)/admin/collections/[collection]/page.tsx`
- `app/(dashboard)/admin/users/page.tsx` (moved from admin/page.tsx)
- `app/(dashboard)/admin/files/page.tsx` (moved from admin/page.tsx)

**New components:**
- `components/admin/AdminSidebar.tsx`
- `components/admin/StatCard.tsx`
- `components/admin/AdminCharts.tsx`
- `components/admin/ThemePreview.tsx`
- `components/admin/ThemeEditor.tsx`
- `components/admin/ContentEditor.tsx`
- `components/admin/CollectionTable.tsx`
- `components/admin/JsonEditorDialog.tsx`

---

## Task 1: Install Dependencies

**Files:** none (package.json updated by npm)

- [ ] **Step 1: Install culori and add shadcn chart component**

```bash
npm install culori
npx shadcn add chart
```

Expected: `culori` in `node_modules`, `components/ui/chart.tsx` created.

- [ ] **Step 2: Verify chart component exists**

```bash
ls components/ui/chart.tsx
```

Expected: file exists.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json components/ui/chart.tsx
git commit -m "chore: add culori and shadcn chart"
```

---

## Task 2: SiteSettings Model

**Files:**
- Create: `lib/models/SiteSettings.ts`

- [ ] **Step 1: Create the model**

```typescript
// lib/models/SiteSettings.ts
import { Schema, Document, models, model } from "mongoose"

export interface ISiteSettingsDoc extends Document {
  primaryColor: string
  fontFamily: string
  fontSize: "sm" | "md" | "lg" | "xl"
  borderRadius: number
  updatedAt: Date
}

const SiteSettingsSchema = new Schema<ISiteSettingsDoc>(
  {
    primaryColor: { type: String, default: "oklch(0.205 0 0)" },
    fontFamily: { type: String, default: "Inter" },
    fontSize: { type: String, enum: ["sm", "md", "lg", "xl"], default: "md" },
    borderRadius: { type: Number, default: 0.625 },
  },
  { timestamps: true }
)

export default models.SiteSettings ?? model<ISiteSettingsDoc>("SiteSettings", SiteSettingsSchema)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/models/SiteSettings.ts
git commit -m "feat: add SiteSettings mongoose model"
```

---

## Task 3: SiteContent Model

**Files:**
- Create: `lib/models/SiteContent.ts`

- [ ] **Step 1: Create the model**

```typescript
// lib/models/SiteContent.ts
import { Schema, Document, models, model } from "mongoose"

export interface ISiteContentDoc extends Document {
  locale: string
  key: string
  value: string
  updatedAt: Date
}

const SiteContentSchema = new Schema<ISiteContentDoc>(
  {
    locale: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: String, required: true },
  },
  { timestamps: true }
)

SiteContentSchema.index({ locale: 1, key: 1 }, { unique: true })

export default models.SiteContent ?? model<ISiteContentDoc>("SiteContent", SiteContentSchema)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/models/SiteContent.ts
git commit -m "feat: add SiteContent mongoose model"
```

---

## Task 4: Color Utilities

**Files:**
- Create: `lib/colorUtils.ts`

- [ ] **Step 1: Create color conversion utilities**

```typescript
// lib/colorUtils.ts
import { formatCss, formatHex, oklch, parse } from "culori"

export function hexToOklch(hex: string): string {
  const color = parse(hex)
  if (!color) return hex
  const converted = oklch(color)
  if (!converted) return hex
  return formatCss(converted)
}

export function oklchToHex(oklchStr: string): string {
  const color = parse(oklchStr)
  if (!color) return "#000000"
  return formatHex(color) ?? "#000000"
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/colorUtils.ts
git commit -m "feat: add hex/oklch color conversion utilities"
```

---

## Task 5: SiteSettings Server Utility

**Files:**
- Create: `lib/siteSettings.ts`

- [ ] **Step 1: Create the utility**

> **Note:** Verify `unstable_cache` import path in `node_modules/next/dist/docs/` — in Next.js 16 it may be stable. Fall back to `import { unstable_cache } from "next/cache"` if the stable API is not yet exported.

```typescript
// lib/siteSettings.ts
import { unstable_cache } from "next/cache"
import { connectDB } from "@/lib/db"
import SiteSettings from "@/lib/models/SiteSettings"

const DEFAULT_SETTINGS = {
  primaryColor: "oklch(0.205 0 0)",
  fontFamily: "Inter",
  fontSize: "md" as "sm" | "md" | "lg" | "xl",
  borderRadius: 0.625,
}

export type SiteSettingsData = typeof DEFAULT_SETTINGS

const FONT_SIZE_MAP: Record<string, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
  xl: "20px",
}

const FONT_URL_MAP: Record<string, string> = {
  Inter: "Inter:wght@400;500;600;700",
  Roboto: "Roboto:wght@400;500;700",
  "Playfair Display": "Playfair+Display:wght@400;600;700",
  Lato: "Lato:wght@400;700",
  Merriweather: "Merriweather:wght@400;700",
}

export const getSiteSettings = unstable_cache(
  async (): Promise<SiteSettingsData> => {
    await connectDB()
    const doc = await SiteSettings.findOne().lean<SiteSettingsData>()
    if (!doc) return DEFAULT_SETTINGS
    return {
      primaryColor: doc.primaryColor ?? DEFAULT_SETTINGS.primaryColor,
      fontFamily: doc.fontFamily ?? DEFAULT_SETTINGS.fontFamily,
      fontSize: doc.fontSize ?? DEFAULT_SETTINGS.fontSize,
      borderRadius: doc.borderRadius ?? DEFAULT_SETTINGS.borderRadius,
    }
  },
  ["site-settings"],
  { revalidate: 60, tags: ["site-settings"] }
)

export function buildThemeStyle(settings: SiteSettingsData): string {
  const fontSize = FONT_SIZE_MAP[settings.fontSize] ?? "16px"
  return `:root{--primary:${settings.primaryColor};--radius:${settings.borderRadius}rem}html{font-size:${fontSize};font-family:'${settings.fontFamily}',sans-serif}`
}

export function getFontUrl(fontFamily: string): string {
  const family = FONT_URL_MAP[fontFamily] ?? FONT_URL_MAP.Inter
  return `https://fonts.googleapis.com/css2?family=${family}&display=swap`
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/siteSettings.ts
git commit -m "feat: add getSiteSettings server utility with cache"
```

---

## Task 6: Inject Theme in Root Layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Read current file**

Read `app/layout.tsx` to confirm current content before editing.

- [ ] **Step 2: Replace layout to inject theme + font**

```typescript
// app/layout.tsx
import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { Providers } from "@/components/providers"
import { getSiteSettings, buildThemeStyle, getFontUrl } from "@/lib/siteSettings"
import "./globals.css"

export const metadata: Metadata = {
  title: "FamilyRoots — Discover Your Family History",
  description: "Build, explore, and share your family tree with AI-powered tools",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const settings = await getSiteSettings()
  const themeStyle = buildThemeStyle(settings)
  const fontUrl = getFontUrl(settings.fontFamily)

  return (
    <html lang={locale} dir={locale === "he" ? "rtl" : "ltr"}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={fontUrl} rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify dev server starts without error**

```bash
npm run dev
```

Visit `http://localhost:3000` — app should look identical to before (default theme loads from defaults, no DB doc yet).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: inject site theme from DB into root layout"
```

---

## Task 7: AdminSidebar Component

**Files:**
- Create: `components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/admin/AdminSidebar.tsx
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Palette,
  FileText,
  Database,
  Users,
  FolderOpen,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/theme", label: "Theme", icon: Palette },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/collections", label: "Collections", icon: Database },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/files", label: "Files", icon: FolderOpen },
]

export function AdminSidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-52 border-r bg-gray-50 min-h-screen pt-4 flex-shrink-0">
      <div className="flex items-center gap-2 px-4 mb-4">
        <ShieldCheck className="h-5 w-5 text-amber-500" />
        <span className="font-semibold text-sm">Admin</span>
      </div>
      <nav className="space-y-1 px-3">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-amber-100 text-amber-800 font-medium"
                : "text-gray-700 hover:bg-amber-50 hover:text-amber-800"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/AdminSidebar.tsx
git commit -m "feat: add AdminSidebar component"
```

---

## Task 8: Update Admin Layout + Redirect Page

**Files:**
- Modify: `app/(dashboard)/admin/layout.tsx`
- Modify: `app/(dashboard)/admin/page.tsx`

- [ ] **Step 1: Update admin layout to include sidebar**

```typescript
// app/(dashboard)/admin/layout.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/dashboard")
  }
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Replace admin/page.tsx with redirect**

```typescript
// app/(dashboard)/admin/page.tsx
import { redirect } from "next/navigation"

export default function AdminPage() {
  redirect("/admin/dashboard")
}
```

- [ ] **Step 3: Verify redirect works**

```bash
npm run dev
```

Visit `http://localhost:3000/admin` as admin user — should redirect to `/admin/dashboard` (404 for now, that's expected).

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/admin/layout.tsx app/(dashboard)/admin/page.tsx
git commit -m "feat: add admin sidebar shell and redirect"
```

---

## Task 9: Migrate Users Page

**Files:**
- Create: `app/(dashboard)/admin/users/page.tsx`

- [ ] **Step 1: Create users sub-page** (extract users tab from old `admin/page.tsx`)

```typescript
// app/(dashboard)/admin/users/page.tsx
"use client"
import { useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
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
        <h1 className="text-xl font-bold">Users ({users.length})</h1>
      </div>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
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
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
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
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete {deleteTarget?.name} and all their data. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/admin/users/page.tsx"
git commit -m "feat: add admin/users sub-page"
```

---

## Task 10: Migrate Files Page

**Files:**
- Create: `app/(dashboard)/admin/files/page.tsx`

- [ ] **Step 1: Create files sub-page** (extract files tab from old `admin/page.tsx`)

```typescript
// app/(dashboard)/admin/files/page.tsx
"use client"
import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FolderOpen, FileText, Trash2 } from "lucide-react"

interface CloudinaryResource {
  public_id: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  created_at: string
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`)
    return r.json()
  })

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AdminFilesPage() {
  const { data: files = [], mutate } = useSWR<CloudinaryResource[]>("/api/admin/files", fetcher)
  const [deleteTarget, setDeleteTarget] = useState<CloudinaryResource | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!deleteTarget) return
    setLoading(true)
    const res = await fetch("/api/admin/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicId: deleteTarget.public_id,
        resourceType: deleteTarget.resource_type,
      }),
    })
    if (res.ok) {
      await mutate()
      setDeleteTarget(null)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">Files ({files.length})</h1>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {files.map((file) => (
          <Card key={file.public_id} className="overflow-hidden">
            <div className="h-32 bg-gray-100 flex items-center justify-center">
              {file.resource_type === "image" ? (
                <img src={file.secure_url} alt={file.public_id} className="h-full w-full object-cover" />
              ) : (
                <FileText className="h-10 w-10 text-gray-400" />
              )}
            </div>
            <CardContent className="p-2 space-y-1">
              <p className="text-xs font-medium truncate" title={file.public_id}>
                {file.public_id.split("/").pop()}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{formatBytes(file.bytes)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(file)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                {new Date(file.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
        {files.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground py-6 text-center">
            No files uploaded yet.
          </p>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete {deleteTarget?.public_id.split("/").pop()} from Cloudinary. Cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify dev server — /admin/users and /admin/files both work**

```bash
npm run dev
```

Visit `/admin/users` and `/admin/files` as admin — both should render their tables.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/admin/files/page.tsx"
git commit -m "feat: add admin/files sub-page"
```

---

## Task 11: Stats API Route

**Files:**
- Create: `app/api/admin/stats/route.ts`

- [ ] **Step 1: Create stats route**

```typescript
// app/api/admin/stats/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Event from "@/lib/models/Event"
import Relationship from "@/lib/models/Relationship"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [userCount, treeCount, personCount, eventCount] = await Promise.all([
    User.countDocuments(),
    Tree.countDocuments(),
    Person.countDocuments(),
    Event.countDocuments(),
  ])

  const registrations = await User.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ])

  const personsOverTime = await Person.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ])

  const relationshipTypes = await Relationship.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $project: { type: "$_id", count: 1, _id: 0 } },
  ])

  const treesPerUser = await Tree.aggregate([
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmpty: true } },
    {
      $project: {
        name: { $ifNull: ["$user.name", "Unknown"] },
        count: 1,
        _id: 0,
      },
    },
  ])

  return NextResponse.json({
    counts: { users: userCount, trees: treeCount, persons: personCount, events: eventCount },
    registrations,
    personsOverTime,
    relationshipTypes,
    treesPerUser,
  })
}
```

- [ ] **Step 2: Verify route responds**

Start dev server and run in browser console (as admin session):
```javascript
fetch("/api/admin/stats").then(r => r.json()).then(console.log)
```

Expected: `{ counts: { users: N, trees: N, ... }, registrations: [...], ... }`

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/stats/route.ts
git commit -m "feat: add /api/admin/stats route"
```

---

## Task 12: StatCard Component + Charts Dashboard Page

**Files:**
- Create: `components/admin/StatCard.tsx`
- Create: `components/admin/AdminCharts.tsx`
- Create: `app/(dashboard)/admin/dashboard/page.tsx`

- [ ] **Step 1: Create StatCard component**

```typescript
// components/admin/StatCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: number
  icon: LucideIcon
}

export function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create AdminCharts component**

```typescript
// components/admin/AdminCharts.tsx
"use client"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatsData {
  registrations: { date: string; count: number }[]
  personsOverTime: { date: string; count: number }[]
  relationshipTypes: { type: string; count: number }[]
  treesPerUser: { name: string; count: number }[]
}

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export function AdminCharts({ data }: { data: StatsData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">User Registrations (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: "Registrations", color: "var(--chart-1)" } }} className="h-[200px]">
            <AreaChart data={data.registrations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="count" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.2} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Persons Added (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: "Persons", color: "var(--chart-2)" } }} className="h-[200px]">
            <LineChart data={data.personsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="count" stroke="var(--chart-2)" dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Relationship Types</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}} className="h-[200px]">
            <PieChart>
              <Pie data={data.relationshipTypes} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={70} label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {data.relationshipTypes.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trees per User (top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: "Trees", color: "var(--chart-3)" } }} className="h-[200px]">
            <BarChart data={data.treesPerUser} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create dashboard page**

```typescript
// app/(dashboard)/admin/dashboard/page.tsx
import { Users, Trees, User, Calendar } from "lucide-react"
import { StatCard } from "@/components/admin/StatCard"
import { AdminCharts } from "@/components/admin/AdminCharts"
import { connectDB } from "@/lib/db"
import UserModel from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Event from "@/lib/models/Event"
import Relationship from "@/lib/models/Relationship"

async function getStats() {
  await connectDB()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [userCount, treeCount, personCount, eventCount] = await Promise.all([
    UserModel.countDocuments(),
    Tree.countDocuments(),
    Person.countDocuments(),
    Event.countDocuments(),
  ])

  const registrations = await UserModel.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ])

  const personsOverTime = await Person.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ])

  const relationshipTypes = await Relationship.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $project: { type: "$_id", count: 1, _id: 0 } },
  ])

  const treesPerUser = await Tree.aggregate([
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: { path: "$user", preserveNullAndEmpty: true } },
    { $project: { name: { $ifNull: ["$user.name", "Unknown"] }, count: 1, _id: 0 } },
  ])

  return {
    counts: { users: userCount, trees: treeCount, persons: personCount, events: eventCount },
    registrations,
    personsOverTime,
    relationshipTypes,
    treesPerUser,
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.counts.users} icon={Users} />
        <StatCard title="Total Trees" value={stats.counts.trees} icon={Trees} />
        <StatCard title="Total Persons" value={stats.counts.persons} icon={User} />
        <StatCard title="Total Events" value={stats.counts.events} icon={Calendar} />
      </div>
      <AdminCharts data={stats} />
    </div>
  )
}
```

- [ ] **Step 4: Verify dashboard renders**

Visit `/admin/dashboard` as admin — stat cards and 4 charts visible.

- [ ] **Step 5: Commit**

```bash
git add components/admin/StatCard.tsx components/admin/AdminCharts.tsx "app/(dashboard)/admin/dashboard/page.tsx"
git commit -m "feat: add admin dashboard with stat cards and charts"
```

---

## Task 13: Settings API Route

**Files:**
- Create: `app/api/admin/settings/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/admin/settings/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import SiteSettings from "@/lib/models/SiteSettings"
import { revalidateTag } from "next/cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const settings = await SiteSettings.findOne().lean()
  return NextResponse.json(
    settings ?? {
      primaryColor: "oklch(0.205 0 0)",
      fontFamily: "Inter",
      fontSize: "md",
      borderRadius: 0.625,
    }
  )
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const allowed = ["primaryColor", "fontFamily", "fontSize", "borderRadius"]
  const update = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  await connectDB()
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, new: true }
  ).lean()

  revalidateTag("site-settings")
  return NextResponse.json(settings)
}
```

- [ ] **Step 2: Verify route**

In browser console (as admin):
```javascript
fetch("/api/admin/settings").then(r => r.json()).then(console.log)
```

Expected: `{ primaryColor: "oklch(0.205 0 0)", fontFamily: "Inter", fontSize: "md", borderRadius: 0.625 }` (defaults if no DB doc).

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/settings/route.ts
git commit -m "feat: add /api/admin/settings GET/PUT route"
```

---

## Task 14: ThemePreview Component

**Files:**
- Create: `components/admin/ThemePreview.tsx`

- [ ] **Step 1: Create the preview component**

```typescript
// components/admin/ThemePreview.tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const FONT_SIZE_MAP: Record<string, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
  xl: "20px",
}

interface ThemePreviewProps {
  primaryColor: string
  fontFamily: string
  fontSize: "sm" | "md" | "lg" | "xl"
  borderRadius: number
}

export function ThemePreview({ primaryColor, fontFamily, fontSize, borderRadius }: ThemePreviewProps) {
  return (
    <div
      style={
        {
          "--primary": primaryColor,
          "--radius": `${borderRadius}rem`,
          fontFamily: `'${fontFamily}', sans-serif`,
          fontSize: FONT_SIZE_MAP[fontSize],
        } as React.CSSProperties
      }
      className="border rounded-xl p-4 bg-background space-y-3"
    >
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Preview</p>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>FamilyRoots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Discover your family history.</p>
          <div className="flex gap-2">
            <Button size="sm">Get Started</Button>
            <Button size="sm" variant="outline">Learn More</Button>
          </div>
          <div className="flex gap-2">
            <Badge>Admin</Badge>
            <Badge variant="secondary">User</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/ThemePreview.tsx
git commit -m "feat: add ThemePreview component"
```

---

## Task 15: ThemeEditor Component + Theme Page

**Files:**
- Create: `components/admin/ThemeEditor.tsx`
- Create: `app/(dashboard)/admin/theme/page.tsx`

- [ ] **Step 1: Create ThemeEditor component**

```typescript
// components/admin/ThemeEditor.tsx
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ThemePreview } from "@/components/admin/ThemePreview"
import { hexToOklch, oklchToHex } from "@/lib/colorUtils"
import type { SiteSettingsData } from "@/lib/siteSettings"

const FONT_FAMILIES = ["Inter", "Roboto", "Playfair Display", "Lato", "Merriweather"]
const FONT_SIZES = [
  { value: "sm", label: "Small (14px)" },
  { value: "md", label: "Medium (16px)" },
  { value: "lg", label: "Large (18px)" },
  { value: "xl", label: "XL (20px)" },
]

export function ThemeEditor({ initial }: { initial: SiteSettingsData }) {
  const router = useRouter()
  const [settings, setSettings] = useState<SiteSettingsData>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof SiteSettingsData>(key: K, value: SiteSettingsData[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    if (res.ok) {
      setSaved(true)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Primary Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={oklchToHex(settings.primaryColor)}
              onChange={(e) => set("primaryColor", hexToOklch(e.target.value))}
              className="h-10 w-16 cursor-pointer rounded border p-1"
            />
            <span className="text-sm font-mono text-muted-foreground">{settings.primaryColor}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Font Family</Label>
          <Select value={settings.fontFamily} onValueChange={(v) => set("fontFamily", v)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Font Size</Label>
          <Select value={settings.fontSize} onValueChange={(v) => set("fontSize", v as Settings["fontSize"])}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Border Radius: {settings.borderRadius}rem</Label>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.125}
            value={settings.borderRadius}
            onChange={(e) => set("borderRadius", parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Theme"}
        </Button>
      </div>

      <ThemePreview
        primaryColor={settings.primaryColor}
        fontFamily={settings.fontFamily}
        fontSize={settings.fontSize}
        borderRadius={settings.borderRadius}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create theme page**

```typescript
// app/(dashboard)/admin/theme/page.tsx
import { Palette } from "lucide-react"
import { ThemeEditor } from "@/components/admin/ThemeEditor"
import { getSiteSettings } from "@/lib/siteSettings"

export default async function AdminThemePage() {
  const settings = await getSiteSettings()
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">Theme</h1>
      </div>
      <ThemeEditor initial={settings} />
    </div>
  )
}
```

- [ ] **Step 3: Verify theme editor works end-to-end**

Visit `/admin/theme` — change primary color, see live preview update. Click Save — page should refresh and app should use new theme globally.

- [ ] **Step 4: Commit**

```bash
git add components/admin/ThemeEditor.tsx "app/(dashboard)/admin/theme/page.tsx"
git commit -m "feat: add theme editor with live preview"
```

---

## Task 16: SiteContent Utility + Layout Integration

**Files:**
- Create: `lib/siteContent.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create siteContent utility**

```typescript
// lib/siteContent.ts
import { connectDB } from "@/lib/db"
import SiteContent from "@/lib/models/SiteContent"

export async function getSiteContent(locale: string): Promise<{ key: string; value: string }[]> {
  await connectDB()
  const docs = await SiteContent.find({ locale }).lean()
  return docs.map((d) => ({ key: d.key, value: d.value }))
}

export function applyContentOverrides(
  messages: Record<string, unknown>,
  overrides: { key: string; value: string }[]
): Record<string, unknown> {
  const result = structuredClone(messages)
  for (const { key, value } of overrides) {
    const parts = key.split(".")
    let obj = result as Record<string, unknown>
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof obj[parts[i]] !== "object" || obj[parts[i]] === null) {
        obj[parts[i]] = {}
      }
      obj = obj[parts[i]] as Record<string, unknown>
    }
    obj[parts[parts.length - 1]] = value
  }
  return result
}
```

- [ ] **Step 2: Update app/layout.tsx to merge content overrides**

```typescript
// app/layout.tsx
import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { Providers } from "@/components/providers"
import { getSiteSettings, buildThemeStyle, getFontUrl } from "@/lib/siteSettings"
import { getSiteContent, applyContentOverrides } from "@/lib/siteContent"
import "./globals.css"

export const metadata: Metadata = {
  title: "FamilyRoots — Discover Your Family History",
  description: "Build, explore, and share your family tree with AI-powered tools",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const [messages, settings, overrides] = await Promise.all([
    getMessages(),
    getSiteSettings(),
    getSiteContent(locale),
  ])
  const mergedMessages = applyContentOverrides(messages as Record<string, unknown>, overrides)
  const themeStyle = buildThemeStyle(settings)
  const fontUrl = getFontUrl(settings.fontFamily)

  return (
    <html lang={locale} dir={locale === "he" ? "rtl" : "ltr"}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={fontUrl} rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={mergedMessages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/siteContent.ts app/layout.tsx
git commit -m "feat: merge DB content overrides into next-intl messages"
```

---

## Task 17: Content API Routes

**Files:**
- Create: `app/api/admin/content/route.ts`
- Create: `app/api/admin/content/[id]/route.ts`

- [ ] **Step 1: Create content list + upsert route**

```typescript
// app/api/admin/content/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import SiteContent from "@/lib/models/SiteContent"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") ?? "en"

  await connectDB()
  const docs = await SiteContent.find({ locale }).lean()
  return NextResponse.json(docs)
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { locale, key, value } = await request.json()
  if (!locale || !key || value === undefined) {
    return NextResponse.json({ error: "locale, key, value required" }, { status: 400 })
  }

  await connectDB()
  const doc = await SiteContent.findOneAndUpdate(
    { locale, key },
    { $set: { value } },
    { upsert: true, new: true }
  ).lean()
  return NextResponse.json(doc)
}
```

- [ ] **Step 2: Create content delete route**

```typescript
// app/api/admin/content/[id]/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import SiteContent from "@/lib/models/SiteContent"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await connectDB()
  await SiteContent.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/content/route.ts "app/api/admin/content/[id]/route.ts"
git commit -m "feat: add /api/admin/content CRUD routes"
```

---

## Task 18: ContentEditor Component + Content Page

**Files:**
- Create: `components/admin/ContentEditor.tsx`
- Create: `app/(dashboard)/admin/content/page.tsx`

- [ ] **Step 1: Create ContentEditor component**

```typescript
// components/admin/ContentEditor.tsx
"use client"
import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Override {
  _id: string
  key: string
  value: string
}

interface ContentEditorProps {
  defaults: Record<string, string>
  initialOverrides: Record<string, Override>
  locale: string
}

export function ContentEditor({ defaults, initialOverrides, locale }: ContentEditorProps) {
  const [overrides, setOverrides] = useState<Record<string, Override>>(initialOverrides)
  const [pending, setPending] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")

  const keys = Object.keys(defaults).filter(
    (k) => !search || k.toLowerCase().includes(search.toLowerCase()) || defaults[k].toLowerCase().includes(search.toLowerCase())
  )

  async function save(key: string) {
    const value = pending[key]
    if (value === undefined) return
    const res = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, key, value }),
    })
    if (res.ok) {
      const doc = await res.json()
      setOverrides((prev) => ({ ...prev, [key]: doc }))
      setPending((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  async function remove(key: string) {
    const override = overrides[key]
    if (!override) return
    await fetch(`/api/admin/content/${override._id}`, { method: "DELETE" })
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setPending((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const currentValue = useCallback(
    (key: string) => pending[key] ?? overrides[key]?.value ?? defaults[key] ?? "",
    [pending, overrides, defaults]
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search keys or values…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-1/3">Key</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-1/3">Default</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Override</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const hasOverride = !!overrides[key]
              return (
                <tr
                  key={key}
                  className={cn(
                    "border-b last:border-0",
                    hasOverride ? "bg-amber-50" : ""
                  )}
                >
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{key}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{defaults[key]}</td>
                  <td className="px-4 py-2">
                    <Input
                      value={currentValue(key)}
                      onChange={(e) =>
                        setPending((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      onBlur={() => save(key)}
                      onKeyDown={(e) => e.key === "Enter" && save(key)}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2">
                    {hasOverride && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground"
                        onClick={() => remove(key)}
                        title="Remove override"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create content page**

```typescript
// app/(dashboard)/admin/content/page.tsx
import { FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContentEditor } from "@/components/admin/ContentEditor"
import { connectDB } from "@/lib/db"
import SiteContent from "@/lib/models/SiteContent"
import enMessages from "@/messages/en.json"
import heMessages from "@/messages/he.json"
import kaMessages from "@/messages/ka.json"

function flattenMessages(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce(
    (acc, [key, val]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (typeof val === "object" && val !== null) {
        Object.assign(acc, flattenMessages(val as Record<string, unknown>, fullKey))
      } else {
        acc[fullKey] = String(val)
      }
      return acc
    },
    {} as Record<string, string>
  )
}

const DEFAULT_MESSAGES: Record<string, Record<string, string>> = {
  en: flattenMessages(enMessages as Record<string, unknown>),
  he: flattenMessages(heMessages as Record<string, unknown>),
  ka: flattenMessages(kaMessages as Record<string, unknown>),
}

async function getOverridesForLocale(locale: string) {
  await connectDB()
  const docs = await SiteContent.find({ locale }).lean()
  return Object.fromEntries(
    docs.map((d) => [d.key, { _id: String(d._id), key: d.key, value: d.value }])
  )
}

export default async function AdminContentPage() {
  const [enOverrides, heOverrides, kaOverrides] = await Promise.all([
    getOverridesForLocale("en"),
    getOverridesForLocale("he"),
    getOverridesForLocale("ka"),
  ])

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">Content</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Override UI text per locale. Amber rows have active overrides. Edit a field and press Enter or click away to save.
      </p>
      <Tabs defaultValue="en">
        <TabsList>
          <TabsTrigger value="en">EN</TabsTrigger>
          <TabsTrigger value="he">HE</TabsTrigger>
          <TabsTrigger value="ka">KA</TabsTrigger>
        </TabsList>
        <TabsContent value="en" className="mt-4">
          <ContentEditor defaults={DEFAULT_MESSAGES.en} initialOverrides={enOverrides} locale="en" />
        </TabsContent>
        <TabsContent value="he" className="mt-4">
          <ContentEditor defaults={DEFAULT_MESSAGES.he} initialOverrides={heOverrides} locale="he" />
        </TabsContent>
        <TabsContent value="ka" className="mt-4">
          <ContentEditor defaults={DEFAULT_MESSAGES.ka} initialOverrides={kaOverrides} locale="ka" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 3: Verify content editor works**

Visit `/admin/content` — table of all translation keys visible. Change a value and press Enter — row turns amber. Verify the change appears on the site (navigate to dashboard, check the overridden string).

- [ ] **Step 4: Commit**

```bash
git add components/admin/ContentEditor.tsx "app/(dashboard)/admin/content/page.tsx"
git commit -m "feat: add content editor with per-locale override table"
```

---

## Task 19: Collections List API

**Files:**
- Create: `app/api/admin/collections/route.ts`

- [ ] **Step 1: Create collections list route**

```typescript
// app/api/admin/collections/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Relationship from "@/lib/models/Relationship"
import Event from "@/lib/models/Event"
import { Model } from "mongoose"

const MODELS: Record<string, Model<any>> = {
  users: User,
  trees: Tree,
  persons: Person,
  relationships: Relationship,
  events: Event,
}

export const ALLOWED_COLLECTIONS = Object.keys(MODELS)

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const counts = await Promise.all(
    ALLOWED_COLLECTIONS.map(async (name) => ({
      name,
      count: await MODELS[name].countDocuments(),
    }))
  )
  return NextResponse.json(counts)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/collections/route.ts
git commit -m "feat: add /api/admin/collections list route"
```

---

## Task 20: Collections CRUD API Routes

**Files:**
- Create: `app/api/admin/collections/[name]/route.ts`
- Create: `app/api/admin/collections/[name]/[id]/route.ts`

- [ ] **Step 1: Create collection items route (list + create)**

```typescript
// app/api/admin/collections/[name]/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Relationship from "@/lib/models/Relationship"
import Event from "@/lib/models/Event"
import { Model } from "mongoose"

const MODELS: Record<string, Model<any>> = {
  users: User,
  trees: Tree,
  persons: Person,
  relationships: Relationship,
  events: Event,
}

function getModel(name: string) {
  return MODELS[name] ?? null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name } = await params
  const Model = getModel(name)
  if (!Model) return NextResponse.json({ error: "Collection not found" }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"))
  const q = searchParams.get("q") ?? ""

  await connectDB()

  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { firstName: { $regex: q, $options: "i" } },
          { lastName: { $regex: q, $options: "i" } },
        ],
      }
    : {}

  const [docs, total] = await Promise.all([
    Model.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Model.countDocuments(filter),
  ])

  return NextResponse.json({
    docs,
    total,
    page,
    pages: Math.ceil(total / limit),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name } = await params
  const Model = getModel(name)
  if (!Model) return NextResponse.json({ error: "Collection not found" }, { status: 404 })

  const body = await request.json()
  await connectDB()
  const doc = await Model.create(body)
  return NextResponse.json(doc, { status: 201 })
}
```

- [ ] **Step 2: Create collection item route (update + delete)**

```typescript
// app/api/admin/collections/[name]/[id]/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Relationship from "@/lib/models/Relationship"
import Event from "@/lib/models/Event"
import { Model } from "mongoose"

const MODELS: Record<string, Model<any>> = {
  users: User,
  trees: Tree,
  persons: Person,
  relationships: Relationship,
  events: Event,
}

function getModel(name: string) {
  return MODELS[name] ?? null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name, id } = await params
  const Model = getModel(name)
  if (!Model) return NextResponse.json({ error: "Collection not found" }, { status: 404 })

  const body = await request.json()
  const { _id, __v, createdAt, updatedAt, ...update } = body

  await connectDB()
  const doc = await Model.findByIdAndUpdate(id, { $set: update }, { new: true }).lean()
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(doc)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name, id } = await params
  const Model = getModel(name)
  if (!Model) return NextResponse.json({ error: "Collection not found" }, { status: 404 })

  await connectDB()
  const doc = await Model.findByIdAndDelete(id).lean()
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/collections/[name]/route.ts" "app/api/admin/collections/[name]/[id]/route.ts"
git commit -m "feat: add collections CRUD API routes"
```

---

## Task 21: JsonEditorDialog Component

**Files:**
- Create: `components/admin/JsonEditorDialog.tsx`

- [ ] **Step 1: Create JSON editor dialog**

```typescript
// components/admin/JsonEditorDialog.tsx
"use client"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const READ_ONLY_KEYS = ["_id", "__v", "createdAt", "updatedAt"]

interface JsonEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  doc: Record<string, unknown> | null
  onSave: (data: Record<string, unknown>) => Promise<void>
}

export function JsonEditorDialog({
  open,
  onOpenChange,
  title,
  doc,
  onSave,
}: JsonEditorDialogProps) {
  const readOnly = Object.fromEntries(
    Object.entries(doc ?? {}).filter(([k]) => READ_ONLY_KEYS.includes(k))
  )
  const editable = Object.fromEntries(
    Object.entries(doc ?? {}).filter(([k]) => !READ_ONLY_KEYS.includes(k))
  )

  const [text, setText] = useState(JSON.stringify(editable, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setText(JSON.stringify(editable, null, 2))
    setError(null)
  }, [doc])

  async function handleSave() {
    try {
      const parsed = JSON.parse(text)
      setSaving(true)
      await onSave(parsed)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof SyntaxError ? `JSON error: ${e.message}` : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {Object.keys(readOnly).length > 0 && (
          <div className="rounded-md bg-gray-50 border p-3 text-xs font-mono space-y-1">
            {Object.entries(readOnly).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-400 w-24 flex-shrink-0">{k}:</span>
                <span className="text-gray-600 break-all">{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null) }}
          className="w-full h-64 font-mono text-xs border rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          spellCheck={false}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/JsonEditorDialog.tsx
git commit -m "feat: add JsonEditorDialog component"
```

---

## Task 22: CollectionTable Component

**Files:**
- Create: `components/admin/CollectionTable.tsx`

- [ ] **Step 1: Create CollectionTable**

```typescript
// components/admin/CollectionTable.tsx
"use client"
import { useState, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { JsonEditorDialog } from "@/components/admin/JsonEditorDialog"
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react"

interface CollectionTableProps {
  collection: string
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`)
    return r.json()
  })

export function CollectionTable({ collection }: CollectionTableProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [editDoc, setEditDoc] = useState<Record<string, unknown> | null>(null)
  const [newDoc, setNewDoc] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  const [confirmInput, setConfirmInput] = useState("")
  const [deleting, setDeleting] = useState(false)

  const url = `/api/admin/collections/${collection}?page=${page}&limit=20${search ? `&q=${encodeURIComponent(search)}` : ""}`
  const { data, mutate, isLoading } = useSWR<{
    docs: Record<string, unknown>[]
    total: number
    page: number
    pages: number
  }>(url, fetcher)

  const columns =
    data?.docs.length
      ? Object.keys(data.docs[0])
          .filter((k) => k !== "__v")
          .slice(0, 6)
      : []

  function cellValue(val: unknown): string {
    if (val === null || val === undefined) return "—"
    if (typeof val === "object") return JSON.stringify(val).slice(0, 40) + "…"
    return String(val).slice(0, 60)
  }

  async function handleSaveEdit(parsed: Record<string, unknown>) {
    if (!editDoc) return
    await fetch(`/api/admin/collections/${collection}/${editDoc._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    })
    mutate()
  }

  async function handleCreate(parsed: Record<string, unknown>) {
    await fetch(`/api/admin/collections/${collection}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    })
    mutate()
  }

  async function handleDelete() {
    if (!deleteTarget || confirmInput !== collection) return
    setDeleting(true)
    await fetch(`/api/admin/collections/${collection}/${deleteTarget.id}`, { method: "DELETE" })
    setDeleting(false)
    setDeleteTarget(null)
    setConfirmInput("")
    mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { setSearch(searchInput); setPage(1) }
          }}
          className="max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={() => { setSearch(searchInput); setPage(1) }}>
          Search
        </Button>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setNewDoc(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Document
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="text-left px-3 py-2 font-medium text-gray-600">
                    {col}
                  </th>
                ))}
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {data?.docs.map((doc) => (
                <tr key={String(doc._id)} className="border-b last:border-0 hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 text-gray-700 max-w-[200px] truncate">
                      {cellValue(doc[col])}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setEditDoc(doc)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() =>
                          setDeleteTarget({
                            id: String(doc._id),
                            label: String(doc.name ?? doc.firstName ?? doc._id),
                          })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data?.docs.length && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                    No documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground">
            Page {data.page} of {data.pages} ({data.total} total)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <JsonEditorDialog
        open={!!editDoc}
        onOpenChange={(open) => { if (!open) setEditDoc(null) }}
        title={`Edit ${collection} document`}
        doc={editDoc}
        onSave={handleSaveEdit}
      />

      <JsonEditorDialog
        open={newDoc}
        onOpenChange={setNewDoc}
        title={`New ${collection} document`}
        doc={{}}
        onSave={handleCreate}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setConfirmInput("") } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <strong>{deleteTarget?.label}</strong>. This cannot be undone.
          </p>
          <p className="text-sm">
            Type <strong>{collection}</strong> to confirm:
          </p>
          <Input
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={collection}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setConfirmInput("") }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmInput !== collection || deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/CollectionTable.tsx
git commit -m "feat: add CollectionTable component with search, pagination, edit, delete"
```

---

## Task 23: Collections Pages

**Files:**
- Create: `app/(dashboard)/admin/collections/page.tsx`
- Create: `app/(dashboard)/admin/collections/[collection]/page.tsx`

- [ ] **Step 1: Create collections list page**

```typescript
// app/(dashboard)/admin/collections/page.tsx
import Link from "next/link"
import { Database, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Relationship from "@/lib/models/Relationship"
import Event from "@/lib/models/Event"

const COLLECTIONS = [
  { name: "users", Model: User },
  { name: "trees", Model: Tree },
  { name: "persons", Model: Person },
  { name: "relationships", Model: Relationship },
  { name: "events", Model: Event },
]

export default async function AdminCollectionsPage() {
  await connectDB()
  const counts = await Promise.all(
    COLLECTIONS.map(async ({ name, Model }) => ({
      name,
      count: await Model.countDocuments(),
    }))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">Collections</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {counts.map(({ name, count }) => (
          <Link key={name} href={`/admin/collections/${name}`}>
            <Card className="hover:border-amber-400 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-base capitalize">{name}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{count.toLocaleString()}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create collection detail page**

```typescript
// app/(dashboard)/admin/collections/[collection]/page.tsx
import { notFound } from "next/navigation"
import { Database } from "lucide-react"
import { CollectionTable } from "@/components/admin/CollectionTable"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

const ALLOWED = ["users", "trees", "persons", "relationships", "events"]

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collection: string }>
}) {
  const { collection } = await params
  if (!ALLOWED.includes(collection)) notFound()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Database className="h-4 w-4" />
        <Link href="/admin/collections" className="hover:text-foreground">Collections</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium capitalize">{collection}</span>
      </div>
      <h1 className="text-xl font-bold capitalize">{collection}</h1>
      <CollectionTable collection={collection} />
    </div>
  )
}
```

- [ ] **Step 3: Verify collections browser end-to-end**

Visit `/admin/collections` — 5 collection cards with doc counts. Click one — paginated table. Edit a row — JSON dialog. Delete a row — requires typing collection name.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/admin/collections/page.tsx" "app/(dashboard)/admin/collections/[collection]/page.tsx"
git commit -m "feat: add collections list and detail pages"
```

---

## Task 24: TypeScript Compile + Build Verification

**Files:** none

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors before proceeding.

- [ ] **Step 2: Run ESLint**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "feat: complete admin panel — theme, content, collections, charts"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Theme: color, font, size change | Tasks 4, 5, 13, 15 |
| Theme global (all users) | Tasks 5, 6 |
| Per-page content management | Tasks 16, 17, 18 |
| Edit any text (UI strings) | Task 18 |
| MongoDB CRUD any collection | Tasks 19, 20, 22, 23 |
| shadcn charts dashboard | Tasks 11, 12 |
| Admin shell with sub-routes | Tasks 7, 8 |
| Users sub-page | Task 9 |
| Files sub-page | Task 10 |
| SiteSettings model | Task 2 |
| SiteContent model | Task 3 |
