# Delete Tree — Design

Date: 2026-07-04

## Problem

A tree owner cannot delete a tree from the UI. The `DELETE /api/trees/[treeId]`
route exists but (a) has no UI trigger and (b) deletes only the `Tree` document,
orphaning that tree's persons, relationships, events, and sibling-hide records in
the database.

## Goals

- Let a tree **owner** permanently delete one of their trees from the UI.
- Deleting a tree removes all of its dependent data (no orphans).
- Deletion requires a strong, deliberate confirmation (type the tree name).
- Delete controls are reachable both from the trees list and from inside an open
  tree.

## Non-Goals

- Soft delete / trash / undo. Deletion is permanent.
- Deleting shared-with-me trees (only owners delete; sharees cannot).
- Transactional/atomic cascade. The app uses no MongoDB transactions elsewhere;
  the cascade is best-effort sequential (see Risk).

## Design

### Backend — cascade delete

Extend the existing owner-scoped `DELETE` handler in
`app/api/trees/[treeId]/route.ts`. Auth stays as-is (`auth()` → 401 if no
session). New sequence:

1. `Tree.findOne({ _id: treeId, ownerId: session.user.id })` — if null, return
   404 (this is the ownership gate; a sharee or stranger gets 404).
2. Collect person IDs: `const personIds = (await Person.find({ treeId }).select("_id")).map(p => p._id)`.
3. `Event.deleteMany({ personId: { $in: personIds } })` — Events reference
   `personId`, not `treeId`.
4. `Person.deleteMany({ treeId })`.
5. `Relationship.deleteMany({ treeId })`.
6. `SiblingHide.deleteMany({ treeId })`.
7. `Tree.deleteOne({ _id: treeId, ownerId: session.user.id })`.
8. Return `{ success: true }`.

Shares live in `Tree.sharedEmails` (embedded), so they vanish with the tree
document — no separate cleanup.

Models confirmed to carry `treeId`: `Person`, `Relationship`, `SiblingHide`.
`Event` carries `personId` only.

### Frontend — shared confirmation dialog

New component `components/tree/DeleteTreeDialog.tsx`:

- Props: `treeId: string`, `treeName: string`, `open: boolean`,
  `onOpenChange: (open: boolean) => void`, `onDeleted: () => void`.
- Body: warning text naming the tree and stating that all persons,
  relationships, and events will be permanently removed; a text `Input`; a
  Delete button **disabled until the typed value === `treeName` exactly**; a
  Cancel button.
- On Delete: `fetch(\`/api/trees/${treeId}\`, { method: "DELETE" })`. On success,
  call `onDeleted()` and close. On failure, show `deleteError` inline; keep the
  dialog open. A `deleting` busy state disables the button while in flight.

Uses shadcn `Dialog`, `Input`, `Button`, `Label`, matching existing dialogs
(e.g. the share dialog in the tree page).

### Frontend — call sites

**Trees list** (`app/(dashboard)/trees/page.tsx`): a small delete button on each
**owned** tree card only (not on shared cards). Its `onClick` calls
`e.stopPropagation()` so it does not trigger the card's navigate-to-tree click,
then opens the dialog for that tree. `onDeleted` → `mutate()` (from `useTrees`)
to refresh the list. Track which tree's dialog is open via a
`deleteTarget: ITree | null` state.

**Tree page** (`app/(dashboard)/trees/[treeId]/page.tsx`): a Delete button in the
header action row, rendered only when `isOwner`. Opens the dialog for the current
tree. `onDeleted` → `router.push("/trees")`.

### i18n

Add to the `tree` namespace in `messages/{en,ka,he}.json` (keys parallel across
all three locales):

- `deleteTree` — button/label, e.g. "Delete tree".
- `deleteTreeWarning` — warning body naming what is removed.
- `deleteTreeTypeName` — input label/placeholder, e.g. "Type the tree name to
  confirm".
- `deleteError` — failure message.

Reuse `common.deleting` for the busy label if present; otherwise add
`tree.deleting`. (Verify during implementation — `common.deleting` exists in
en.json.)

## Files touched

- `app/api/trees/[treeId]/route.ts` — cascade in the DELETE handler.
- `components/tree/DeleteTreeDialog.tsx` — new shared dialog (create).
- `app/(dashboard)/trees/page.tsx` — per-owned-card delete button + dialog state.
- `app/(dashboard)/trees/[treeId]/page.tsx` — owner-only header delete button.
- `messages/en.json`, `messages/ka.json`, `messages/he.json` — new keys.

## Risk

- **Non-atomic cascade.** If a later `deleteMany` fails after earlier ones
  succeed, some dependent data is removed while the tree may remain. Accepted:
  the app uses no transactions anywhere, and the failure window is small. The
  tree delete is last, so a mid-cascade failure leaves the tree still owned and
  re-deletable.
- **No automated API-route tests** (repo convention). Verify by deleting a real
  tree and confirming persons/relationships/events/sibling-hides for that
  `treeId` are gone and other trees are untouched.

## Verification

- Owner sees a delete button on their tree card and inside the tree; a sharee
  sees neither (list shows shared cards without the button; tree page hides it
  when `!isOwner`).
- Delete button stays disabled until the exact tree name is typed.
- After deletion: the tree disappears from the list (list case) or the app
  navigates to `/trees` (tree-page case); the tree's persons, relationships,
  events, and sibling-hides are gone from the DB; unrelated trees are intact.
- A non-owner calling `DELETE` directly gets 404 (no deletion).
- `npm run lint`, `npm test`, `npm run build` pass.
