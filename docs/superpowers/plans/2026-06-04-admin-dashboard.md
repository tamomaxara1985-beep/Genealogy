# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin role system and a protected `/admin` dashboard where admins can manage all users (view/change role/delete) and all Cloudinary-uploaded files (view/delete).

**Architecture:** Role is stored on the User model and propagated through NextAuth JWT → session. A layout server component gates the `/admin` route group, redirecting non-admins. Admin API routes use a shared `getAdminSession()` helper. The dashboard page is a two-tab client component (Users + Files).

**Tech Stack:** Next.js 16 App Router, NextAuth v5 (beta.31), Mongoose 9, Tailwind v4, shadcn/ui (Base UI primitives), SWR, Cloudinary Admin API (raw HTTP, no package).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/models/User.ts` | Modify | Add `role` field to schema |
| `types/index.ts` | Modify | Add `role` to `IUser` |
| `lib/auth.ts` | Modify | Propagate role in JWT/session callbacks |
| `lib/adminAuth.ts` | Create | `getAdminSession()` helper |
| `app/api/admin/users/route.ts` | Create | `GET /api/admin/users` |
| `app/api/admin/users/[userId]/route.ts` | Create | `PATCH` + `DELETE` per user |
| `app/api/admin/files/route.ts` | Create | `GET` + `DELETE` Cloudinary files |
| `app/(dashboard)/admin/layout.tsx` | Create | Admin route guard (server component) |
| `app/(dashboard)/admin/page.tsx` | Create | Two-tab admin UI |
| `components/layout/Sidebar.tsx` | Modify | Conditional admin link |

---

## Task 1: Add `role` field to User model and types

**Files:**
- Modify: `lib/models/User.ts`
- Modify: `types/index.ts`

- [ ] **Step 1: Update `lib/models/User.ts`**

Replace entire file with:

```typescript
import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  role: "user" | "admin";
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
  },
  { timestamps: true }
);

export default models.User ?? model<IUserDoc>("User", UserSchema);
```

- [ ] **Step 2: Update `types/index.ts` — add `role` to `IUser`**

Find the `IUser` interface (around line 1–7) and replace it with:

```typescript
export interface IUser {
  _id: string
  name: string
  email: string
  image?: string
  role: 'user' | 'admin'
  createdAt: Date
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/models/User.ts types/index.ts
git commit -m "feat: add role field to User model (default: user)"
```

---

## Task 2: Propagate role through NextAuth JWT and session

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Replace `lib/auth.ts` with the updated version**

```typescript
import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "./db";
import User from "./models/User";

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: { id: string; role: string } & DefaultSession["user"];
  }
}

const googleProvider =
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...googleProvider,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase(),
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        if (!token.email) throw new Error("Google account missing email");
        await connectDB();
        const dbUser = await User.findOneAndUpdate(
          { email: token.email },
          {
            $set: { name: token.name, image: token.picture },
            $setOnInsert: { email: token.email },
          },
          { upsert: true, new: true }
        );
        token.id = dbUser._id.toString();
        token.role = dbUser.role;
      } else if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: propagate user role through NextAuth JWT and session"
```

---

## Task 3: Create `getAdminSession` helper

**Files:**
- Create: `lib/adminAuth.ts`

- [ ] **Step 1: Create the file**

```typescript
import { auth } from "@/lib/auth"

export async function getAdminSession() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "admin") return null
  return session
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/adminAuth.ts
git commit -m "feat: add getAdminSession helper for admin API routes"
```

---

## Task 4: Users API routes

**Files:**
- Create: `app/api/admin/users/route.ts`
- Create: `app/api/admin/users/[userId]/route.ts`

- [ ] **Step 1: Create `app/api/admin/users/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/adminAuth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 }).lean()
  return NextResponse.json(users)
}
```

- [ ] **Step 2: Create `app/api/admin/users/[userId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/adminAuth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Relationship from "@/lib/models/Relationship"
import Event from "@/lib/models/Event"

type Params = { params: Promise<{ userId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId } = await params
  const { role } = await req.json()

  if (!["user", "admin"].includes(role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })

  if (userId === session.user.id && role === "user")
    return NextResponse.json({ error: "Cannot demote yourself" }, { status: 400 })

  await connectDB()
  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true, projection: { password: 0 } }
  )
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId } = await params

  if (userId === session.user.id)
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })

  await connectDB()

  const trees = await Tree.find({ ownerId: userId }, "_id").lean()
  const treeIds = trees.map((t) => t._id)

  if (treeIds.length > 0) {
    const persons = await Person.find({ treeId: { $in: treeIds } }, "_id").lean()
    const personIds = persons.map((p) => p._id)
    if (personIds.length > 0) {
      await Event.deleteMany({ personId: { $in: personIds } })
    }
    await Relationship.deleteMany({ treeId: { $in: treeIds } })
    await Person.deleteMany({ treeId: { $in: treeIds } })
    await Tree.deleteMany({ ownerId: userId })
  }

  await User.findByIdAndDelete(userId)
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify GET route returns 403 for unauthenticated request**

```bash
curl -s -o - -w "\nHTTP:%{http_code}" http://localhost:3000/api/admin/users
```

Expected: `{"error":"Forbidden"}` with `HTTP:403`

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/users/route.ts "app/api/admin/users/[userId]/route.ts"
git commit -m "feat: add admin users API (GET, PATCH role, DELETE with cascade)"
```

---

## Task 5: Files API route (Cloudinary Admin API)

**Files:**
- Create: `app/api/admin/files/route.ts`

- [ ] **Step 1: Create `app/api/admin/files/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/adminAuth"

function basicAuth() {
  const key = process.env.CLOUDINARY_API_KEY!
  const secret = process.env.CLOUDINARY_API_SECRET!
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64")
}

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME
const BASE = `https://api.cloudinary.com/v1_1/${CLOUD}`

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const auth = basicAuth()

  const [imagesRes, rawRes] = await Promise.all([
    fetch(
      `${BASE}/resources/image?prefix=genealogy/photos&type=upload&max_results=500`,
      { headers: { Authorization: auth } }
    ),
    fetch(
      `${BASE}/resources/raw?prefix=genealogy/documents&type=upload&max_results=500`,
      { headers: { Authorization: auth } }
    ),
  ])

  const [images, raw] = await Promise.all([imagesRes.json(), rawRes.json()])
  const resources = [
    ...(images.resources ?? []),
    ...(raw.resources ?? []),
  ]

  return NextResponse.json(resources)
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { publicId, resourceType } = await req.json()
  if (!publicId || !resourceType)
    return NextResponse.json(
      { error: "publicId and resourceType required" },
      { status: 400 }
    )

  const auth = basicAuth()
  const res = await fetch(
    `${BASE}/resources/${resourceType}/upload?public_ids[]=${encodeURIComponent(publicId)}`,
    { method: "DELETE", headers: { Authorization: auth } }
  )

  if (!res.ok)
    return NextResponse.json({ error: "Cloudinary delete failed" }, { status: 500 })

  return NextResponse.json({ deleted: publicId })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify GET route is gated**

```bash
curl -s -o - -w "\nHTTP:%{http_code}" http://localhost:3000/api/admin/files
```

Expected: `{"error":"Forbidden"}` with `HTTP:403`

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/files/route.ts
git commit -m "feat: add admin files API (GET + DELETE via Cloudinary Admin API)"
```

---

## Task 6: Admin layout guard

**Files:**
- Create: `app/(dashboard)/admin/layout.tsx`

- [ ] **Step 1: Create `app/(dashboard)/admin/layout.tsx`**

```typescript
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/dashboard")
  }
  return <>{children}</>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/admin/layout.tsx"
git commit -m "feat: add admin layout guard — redirects non-admins to /dashboard"
```

---

## Task 7: Admin dashboard page

**Files:**
- Create: `app/(dashboard)/admin/page.tsx`

- [ ] **Step 1: Create `app/(dashboard)/admin/page.tsx`**

```typescript
"use client"
import { useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { ShieldCheck, Trash2, FileText } from "lucide-react"

interface AdminUser {
  _id: string
  name: string
  email: string
  role: "user" | "admin"
  createdAt: string
}

interface CloudinaryResource {
  public_id: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  created_at: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AdminPage() {
  const { data: session } = useSession()
  const { data: users = [], mutate: mutateUsers } = useSWR<AdminUser[]>(
    "/api/admin/users",
    fetcher
  )
  const { data: files = [], mutate: mutateFiles } = useSWR<CloudinaryResource[]>(
    "/api/admin/files",
    fetcher
  )

  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUser | null>(null)
  const [deleteFileTarget, setDeleteFileTarget] = useState<CloudinaryResource | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRoleChange(userId: string, role: string) {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    mutateUsers()
  }

  async function handleDeleteUser() {
    if (!deleteUserTarget) return
    setLoading(true)
    await fetch(`/api/admin/users/${deleteUserTarget._id}`, { method: "DELETE" })
    await mutateUsers()
    setDeleteUserTarget(null)
    setLoading(false)
  }

  async function handleDeleteFile() {
    if (!deleteFileTarget) return
    setLoading(true)
    await fetch("/api/admin/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicId: deleteFileTarget.public_id,
        resourceType: deleteFileTarget.resource_type,
      }),
    })
    await mutateFiles()
    setDeleteFileTarget(null)
    setLoading(false)
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
        </TabsList>

        {/* ── Users tab ── */}
        <TabsContent value="users" className="mt-4">
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
                          onClick={() => setDeleteUserTarget(user)}
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
        </TabsContent>

        {/* ── Files tab ── */}
        <TabsContent value="files" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((file) => (
              <Card key={file.public_id} className="overflow-hidden">
                <div className="h-32 bg-gray-100 flex items-center justify-center">
                  {file.resource_type === "image" ? (
                    <img
                      src={file.secure_url}
                      alt={file.public_id}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileText className="h-10 w-10 text-gray-400" />
                  )}
                </div>
                <CardContent className="p-2 space-y-1">
                  <p
                    className="text-xs font-medium truncate"
                    title={file.public_id}
                  >
                    {file.public_id.split("/").pop()}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {formatBytes(file.bytes)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteFileTarget(file)}
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
        </TabsContent>
      </Tabs>

      {/* ── Delete user dialog ── */}
      <Dialog
        open={!!deleteUserTarget}
        onOpenChange={(open) => { if (!open) setDeleteUserTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete{" "}
            <strong>{deleteUserTarget?.name}</strong> and all their trees,
            persons, relationships, and events. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={loading}
            >
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete file dialog ── */}
      <Dialog
        open={!!deleteFileTarget}
        onOpenChange={(open) => { if (!open) setDeleteFileTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete{" "}
            <strong>{deleteFileTarget?.public_id.split("/").pop()}</strong> from
            Cloudinary. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFileTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFile}
              disabled={loading}
            >
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Check if `Tabs` component is installed**

```bash
ls components/ui/tabs.tsx
```

If file exists, continue. If not, run:

```bash
npx shadcn add tabs
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/admin/page.tsx"
git commit -m "feat: add admin dashboard page with users and files tabs"
```

---

## Task 8: Update Sidebar — conditional admin link

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Replace `components/layout/Sidebar.tsx`**

```typescript
import Link from "next/link";
import { Home, Trees, User, Dna, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/trees", label: "My Trees", icon: Trees },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/dna", label: "DNA Matches", icon: Dna },
];

export async function Sidebar() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  return (
    <aside className="w-56 border-r bg-gray-50 min-h-screen pt-4">
      <nav className="space-y-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
            Admin
          </Link>
        )}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: show Admin link in Sidebar for admin users only"
```

---

## Task 9: Lint, build, and set first admin

**Files:** verification only

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Fix any errors. Common issue: unused imports.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: build completes, no type or module errors.

- [ ] **Step 3: Commit lint/build fixes if any**

```bash
git add -A
git commit -m "chore: lint and build fixes for admin dashboard"
```

- [ ] **Step 4: Set first admin in MongoDB Atlas**

Connect to your Atlas cluster and run in the MongoDB shell or Compass:

```javascript
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)
```

Replace `"your-email@example.com"` with your account email.

- [ ] **Step 5: Manual smoke test**

1. Restart dev server: `npm run dev`
2. Log in with the admin account
3. Verify "Admin" link appears in sidebar
4. Navigate to `http://localhost:3000/admin`
5. Verify Users tab shows all users with role dropdowns
6. Change a user's role — verify dropdown reflects new role on refresh
7. Verify Files tab loads Cloudinary assets
8. Log out, log in as non-admin — verify no Admin link and `/admin` redirects to `/dashboard`
