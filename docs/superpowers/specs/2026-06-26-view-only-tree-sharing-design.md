# View-Only Tree Sharing — Design Spec

**Date:** 2026-06-26
**Status:** Proposed

## Summary

Let a tree owner grant **view-only** access to other people by email address, and revoke it at any time. A viewer can open the shared tree (read-only) but cannot add, edit, or delete anything. Access is by email and "pending" — it works whether or not the invitee already has an account; access activates whenever someone logs in with a matching email.

Single implementation plan (user decision), six parts:
1. Data model + central access helper
2. Relax READ authorization on GET routes (owner OR viewer)
3. Share-management API (grant / revoke)
4. Owner UI — Share dialog
5. Viewer read-only mode
6. Discovery — "Shared with me" + working link

## Current State (baseline)

- Every tree-scoped query is owner-only: `Tree.findOne({ _id: treeId, ownerId: session.user.id })`. Used in **both** read and write handlers across all routes.
- Write handlers (POST/PUT/DELETE) are therefore already owner-only — viewers are blocked from mutations with **no change required**. The security gate is server-side, not UI-dependent.
- Routes affected (GET handlers need relaxing): `/api/trees/[treeId]`, `/api/trees/[treeId]/persons`, `/api/trees/[treeId]/relationships`, `/api/persons/[personId]`, `/api/persons/[personId]/events`.
- The dashboard UI renders without auth checks; data access is enforced at the API layer (per `CLAUDE.md`).
- `Tree` already has an unused `isPublic` boolean — out of scope; not reused for per-email sharing.

## Design Decisions (resolved)

- **Email target:** any email (pending access). No requirement that the email already be a registered account.
- **Authorization match:** a logged-in user is a viewer of a tree if their **session email** (lowercased) is in the tree's `sharedEmails`.
- **Discovery:** both a "Shared with me" list in `/trees` **and** a direct link.
- **Revoke timing:** takes effect on the viewer's next data fetch (returns 404). No live session kick-out.
- **Storage:** `sharedEmails: string[]` array on the `Tree` document. (Rejected: a separate `TreeShare` collection — overkill at this scale; reusing `isPublic` — cannot express per-email grant/revoke.)

---

## Part 1 — Data Model + Access Helper

### `lib/models/Tree.ts`
Add field:
```ts
sharedEmails: { type: [String], default: [] },
```
And to `ITreeDoc`: `sharedEmails: string[];`. Emails are stored **lowercased and trimmed** (normalized at the API layer before write).

### `types/index.ts`
Add `sharedEmails?: string[]` to `ITree`. (Optional on the DTO because it is only returned to the owner — see Part 2.)

### `lib/treeAccess.ts` (new)
Central authorization, replacing the duplicated owner-only query:
```ts
type TreeRole = "owner" | "viewer" | null;

// Returns the tree document and the caller's role, or { tree: null, role: null }
// if the tree does not exist or the caller has no access.
async function resolveTreeAccess(
  treeId: string,
  session: Session | null,
): Promise<{ tree: ITreeDoc | null; role: TreeRole }>;
```
Logic:
- No `session.user.id` → `{ null, null }`.
- Load `Tree.findById(treeId)`. Not found → `{ null, null }`.
- `tree.ownerId === session.user.id` → role `"owner"`.
- Else if `session.user.email` (lowercased) ∈ `tree.sharedEmails` → role `"viewer"`.
- Else → `{ tree: null, role: null }` (treat as not found — do not leak existence).

A second helper for person-scoped routes:
```ts
// Resolves access via the person's tree.
async function resolvePersonAccess(
  personId: string,
  session: Session | null,
): Promise<{ person: IPersonDoc | null; role: TreeRole }>;
```

**Note on session email:** NextAuth's session must expose `user.email`. Verify the session/JWT callbacks in `lib/auth.ts` include `email`; if absent, add it (email is standard on the Credentials user). This is a prerequisite for viewer matching.

---

## Part 2 — Relax READ Authorization

Rewrite the **GET** handlers of the five affected routes to use `resolveTreeAccess` / `resolvePersonAccess`, allowing `role === "owner" || role === "viewer"`; otherwise 404.

- `GET /api/trees/[treeId]` — return the tree. **Strip `sharedEmails` from the response unless `role === "owner"`** (viewers must not see the share list). Include the caller's `role` in the response so the client can set read-only mode.
- `GET /api/trees/[treeId]/persons` — allow owner/viewer.
- `GET /api/trees/[treeId]/relationships` — allow owner/viewer.
- `GET /api/persons/[personId]` — allow owner/viewer.
- `GET /api/persons/[personId]/events` — allow owner/viewer.

**Write handlers (POST/PUT/DELETE) are NOT changed** — they keep the owner-only `findOne({ _id, ownerId })` query, so a viewer attempting a mutation gets 404. (Optionally refactor them to call `resolveTreeAccess` and require `role === "owner"` for consistency, but behavior is identical.)

---

## Part 3 — Share-Management API

New route `app/api/trees/[treeId]/shares/route.ts` — **owner-only** (via `resolveTreeAccess`, require `role === "owner"`, else 403/404):

- `POST` body `{ email: string }`:
  - Validate non-empty, basic email shape; normalize `email.trim().toLowerCase()`.
  - Reject if it equals the owner's own email (no self-share).
  - `Tree.updateOne({ _id }, { $addToSet: { sharedEmails: email } })`.
  - Return `{ sharedEmails }` (full updated list).
- `DELETE` body `{ email: string }`:
  - Normalize, `$pull` from `sharedEmails`.
  - Return `{ sharedEmails }`.

(`GET` of the share list is not a separate endpoint — the owner reads `sharedEmails` from `GET /api/trees/[treeId]`.)

---

## Part 4 — Owner UI: Share Dialog

On the tree page (`app/(dashboard)/trees/[treeId]/page.tsx`), **owner only**:
- A "Share" button in the toolbar opens a dialog (shadcn `Dialog`).
- Dialog contents:
  - Email input + "Grant access" button → `POST .../shares`, then SWR `mutate` the tree.
  - List of current `sharedEmails`, each row with the email and a "Revoke" button → `DELETE .../shares`, then mutate.
  - Empty state: "Not shared with anyone yet."
- Errors (invalid email, self-share) shown inline.

The share list comes from the tree fetch (`sharedEmails`, owner-only).

---

## Part 5 — Viewer Read-Only Mode

- The tree page reads `role` from `GET /api/trees/[treeId]` (or compares `tree.ownerId` to the session user id). `readOnly = role !== "owner"`.
- When `readOnly`:
  - Hide owner-only toolbar actions: Add person, Link people, Share.
  - Pass a `readOnly` prop into the tree so node components hide all **data-mutation** affordances: add-relative buttons, add-spouse/child buttons, edit/delete. Pan, zoom, and select stay. Collapse/expand **stays enabled** — it is the viewer's own readability state (persisted in their localStorage), not a change to the owner's data.
  - Selecting a node opens a **read-only** detail view: no Edit, Delete, or photo-change controls.
  - Show a "View-only" badge near the tree title.
- `/person/[id]` page: hide Edit/Delete for non-owners (compare ownerId to session id, fetched via the person's tree or an added `role` on the person GET response).

**Security note:** read-only UI is cosmetic convenience. The real enforcement is server-side (Parts 2–3): viewers physically cannot mutate because write routes are owner-scoped. UI hiding just prevents confusing dead buttons.

---

## Part 6 — Discovery

- `GET /api/trees` (list): in addition to owned trees, return trees where `session.user.email ∈ sharedEmails`. Shape: return two arrays or tag each tree with `role`. Chosen shape: `{ owned: ITree[], shared: ITree[] }` — explicit and easy to render. (Adjust the trees-list page's fetch accordingly.)
- Trees list page (`app/(dashboard)/trees/page.tsx`): render "My Trees" and a "Shared with me (view-only)" section. Each shared tree links to `/trees/[id]`, opening in read-only mode.
- Direct link: opening `/trees/[id]` as a shared viewer already passes authz (Part 2) — no extra work.

---

## Files Touched

| File | Change |
|------|--------|
| `lib/models/Tree.ts` | add `sharedEmails` field + `ITreeDoc` |
| `types/index.ts` | add `sharedEmails?` to `ITree`; optionally a `role` field on tree DTO |
| `lib/treeAccess.ts` | **new** — `resolveTreeAccess`, `resolvePersonAccess` |
| `lib/auth.ts` | ensure session exposes `user.email` (if not already) |
| `app/api/trees/route.ts` | GET returns owned + shared |
| `app/api/trees/[treeId]/route.ts` | GET allow viewer, strip `sharedEmails`/add `role` |
| `app/api/trees/[treeId]/persons/route.ts` | GET allow viewer |
| `app/api/trees/[treeId]/relationships/route.ts` | GET allow viewer |
| `app/api/persons/[personId]/route.ts` | GET allow viewer |
| `app/api/persons/[personId]/events/route.ts` | GET allow viewer |
| `app/api/trees/[treeId]/shares/route.ts` | **new** — POST/DELETE share management |
| `app/(dashboard)/trees/[treeId]/page.tsx` | Share dialog (owner), read-only mode |
| `app/(dashboard)/trees/page.tsx` | "Shared with me" section |
| `app/(dashboard)/person/[id]/page.tsx` | hide edit/delete for non-owners |
| `components/tree/FamilyTree.tsx` + node components | `readOnly` prop hides mutation affordances |
| `messages/*` (i18n) | new strings (Share, Grant access, Revoke, View-only, Shared with me) |

---

## Out of Scope
- Edit/contributor roles (view-only only).
- Email notifications/invites to the shared address.
- Live revoke kick-out (takes effect on next fetch).
- Public/unlisted link sharing beyond per-email grants (`isPublic` untouched).
- Audit log of who viewed when.

---

## Constraints
- No new dependencies.
- Mongoose schema change limited to the additive `sharedEmails` field.
- TypeScript strict; Tailwind classes only; `cn()` for className composition; `@/*` alias.
- Server-side authorization is the source of truth; UI gating is convenience only.
- Follow existing route pattern: `await auth()` then access check; 401 if no session, 404 if no access.
