# Admin Dashboard — Design Spec

**Date:** 2026-06-04  
**Status:** Approved

## Overview

Add an admin role system and a protected admin dashboard at `/admin`. Admins can manage all users (view, change role, delete) and all Cloudinary-uploaded files (view, delete). The admin link is only visible to admin users. First admin must be set manually in MongoDB Atlas.

## Decisions

| Question | Decision |
|---|---|
| Files source | Cloudinary Admin API (sees all uploads including orphans) |
| Users operations | List + delete + edit role (no create/edit profile) |
| Admin link visibility | Admins only in Sidebar |
| Admin gating strategy | Next.js layout guard (`app/(dashboard)/admin/layout.tsx`) |

---

## Section 1: Data Layer

### `lib/models/User.ts`

Add `role` field to schema and `IUserDoc`:

```typescript
role: { type: String, enum: ['user', 'admin'], default: 'user' }
```

`IUserDoc.role: 'user' | 'admin'`

No DB migration required — Mongoose default applies to existing docs on next read/write.

### `lib/auth.ts`

Propagate role through JWT → session:

- **`jwt` callback:** when `user` object present (fresh login), set `token.role = user.role`
- **`session` callback:** set `session.user.role = token.role as string`
- **Type augmentation:** extend `Session` interface to include `user: { role: string } & DefaultSession["user"]`

Also propagate role for Google OAuth users — set `token.role = dbUser.role` in the Google branch of the `jwt` callback.

### `types/index.ts`

Add `role: 'user' | 'admin'` to `IUser`.

---

## Section 2: API Routes

### Shared helper: `lib/adminAuth.ts`

```typescript
export async function getAdminSession() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}
```

Used in all 5 admin API route handlers. Returns session on success, `null` on failure. Each route checks:

```typescript
const session = await getAdminSession()
if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

Consistent with existing auth pattern: each handler checks auth explicitly and returns 401/403.

### Users API

**`GET /api/admin/users`**
- Requires admin session
- Returns all users: `_id, name, email, role, createdAt` sorted by `createdAt` desc
- Omits `password` field

**`PATCH /api/admin/users/[userId]`**
- Requires admin session
- Body: `{ role: 'user' | 'admin' }`
- Validates role is one of the two allowed values
- Admin cannot demote themselves (returns 400 if `userId === session.user.id && role === 'user'`)
- Updates and returns updated user

**`DELETE /api/admin/users/[userId]`**
- Requires admin session
- Cannot delete self (returns 400 if `userId === session.user.id`)
- Cascades: deletes user's Trees → Persons → Relationships → Events → then User
- Returns 204 on success

### Files API

**`GET /api/admin/files`**
- Requires admin session
- Server-side fetch to Cloudinary Admin API for both folders:
  - `GET https://api.cloudinary.com/v1_1/{cloud}/resources/image?prefix=genealogy/photos&max_results=500`
  - `GET https://api.cloudinary.com/v1_1/{cloud}/resources/raw?prefix=genealogy/documents&max_results=500`
- Auth: Basic `${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}` (base64-encoded)
- Combines and returns both result sets
- Each resource includes: `public_id`, `secure_url`, `resource_type`, `format`, `bytes`, `created_at`

**`DELETE /api/admin/files`**
- Requires admin session
- Body: `{ publicId: string, resourceType: string }`
- Server-side fetch to Cloudinary destroy endpoint:
  - `DELETE https://api.cloudinary.com/v1_1/{cloud}/resources/{resourceType}/upload?public_ids[]={publicId}`
- Returns 200 on success

---

## Section 3: UI

### `app/(dashboard)/admin/layout.tsx` — Server Component

```typescript
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function AdminLayout({ children }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') redirect('/dashboard')
  return <>{children}</>
}
```

All routes under `/admin/` automatically protected. No per-page auth check needed.

### `app/(dashboard)/admin/page.tsx` — Client Component

Two-tab layout using shadcn `<Tabs>`:

**Users tab:**
- SWR fetch from `GET /api/admin/users`
- Table columns: Name, Email, Role, Joined, Actions
- Role column: `<Select>` dropdown (`user` / `admin`) — on change calls `PATCH /api/admin/users/[id]`, revalidates via `mutate()`
- Actions column: Delete button → confirm with shadcn `<Dialog>` → `DELETE /api/admin/users/[id]`
- Current user's row: role dropdown disabled + delete button disabled (can't self-demote or self-delete)

**Files tab:**
- SWR fetch from `GET /api/admin/files`
- Responsive grid of cards
- Image resources: `<img src={secure_url}>` thumbnail (h-32 object-cover)
- Non-image resources (raw/pdf): file icon with format label
- Card footer: `public_id` (truncated), size in KB, upload date
- Delete button per card → confirm dialog → `DELETE /api/admin/files`

### `components/layout/Sidebar.tsx` — Server Component (no changes needed to "use client" — already none)

- Call `await auth()` at top of component
- Existing nav links rendered as before for all users
- Conditionally render Admin nav item after existing links:

```typescript
{session?.user?.role === 'admin' && (
  <Link href="/admin" ...>
    <ShieldCheck className="h-4 w-4" />
    Admin
  </Link>
)}
```

---

## Files Created / Modified

| File | Action |
|---|---|
| `lib/models/User.ts` | Modify — add `role` field |
| `lib/auth.ts` | Modify — propagate role in JWT/session callbacks |
| `lib/adminAuth.ts` | Create — `requireAdmin()` helper |
| `types/index.ts` | Modify — add `role` to `IUser` |
| `app/api/admin/users/route.ts` | Create — GET + (unused placeholder) |
| `app/api/admin/users/[userId]/route.ts` | Create — PATCH + DELETE |
| `app/api/admin/files/route.ts` | Create — GET + DELETE |
| `app/(dashboard)/admin/layout.tsx` | Create — admin layout guard |
| `app/(dashboard)/admin/page.tsx` | Create — admin dashboard UI |
| `components/layout/Sidebar.tsx` | Modify — conditional admin link |

## Out of Scope

- Admin audit log
- Bulk delete operations
- Cloudinary folder management (create/rename folders)
- Searching/filtering users or files
- User profile editing by admin
