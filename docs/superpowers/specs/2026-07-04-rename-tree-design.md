# Rename Tree — Design

Date: 2026-07-04

## Problem

A tree owner cannot rename a tree from the UI. The `PUT /api/trees/[treeId]`
route already updates the tree (owner-scoped `$set` of the body, so `{ name }`
works), but there is no UI to trigger it.

## Goals

- A tree owner can rename their tree from the open tree page.
- The new name is reflected immediately (print title, delete-confirm dialog, and
  anywhere `treeMeta.name` is used) without a manual refresh.

## Non-Goals

- Renaming from the trees list (owner opens the tree to rename — chosen scope).
- Showing the tree name in the tree-page `<h1>` (it currently shows the generic
  "Family Tree" label; left unchanged this iteration).
- Editing any other tree field (description, etc.).

## Design

### Component

New `components/tree/RenameTreeDialog.tsx`, mirroring the existing
`DeleteTreeDialog`:

- Props: `{ treeId: string; currentName: string; open: boolean; onOpenChange: (open: boolean) => void; onRenamed: () => void }`.
- A text `Input` pre-filled with `currentName`.
- Save button disabled while the trimmed value is empty or unchanged
  (`trimmed === "" || trimmed === currentName`) or while saving.
- On Save: `PUT /api/trees/${treeId}` with `{ name: trimmed }`. On ok → call
  `onRenamed()` and close; on failure → show `renameError` inline, keep open.
- Uses shadcn `Dialog`/`Input`/`Label`/`Button`, `useTranslations`, matching the
  delete dialog's structure and reset-on-close behavior.

### Tree page (`app/(dashboard)/trees/[treeId]/page.tsx`)

- Owner-only edit (pencil) button in the header action row, alongside
  Share / Link / Add person / Delete (rendered inside the existing `isOwner`
  block).
- `renameOpen` state controls the dialog.
- The dialog is rendered only when `isOwner && treeMeta`, `currentName={treeMeta.name}`,
  `onRenamed={() => mutateTree()}` (refreshes `treeMeta`).

### i18n (`tree` namespace, en/ka/he, parallel)

- `renameTree` — button aria-label + dialog title.
- `renameError` — failure message.
- Reuse existing `treeName` (input label), `common.save` / `common.saving` /
  `common.cancel`.

## Files touched

- `components/tree/RenameTreeDialog.tsx` — new dialog (create).
- `app/(dashboard)/trees/[treeId]/page.tsx` — pencil button + state + dialog.
- `messages/en.json`, `messages/ka.json`, `messages/he.json` — 2 new keys.

## Risk

- Minimal: reuses the existing owner-scoped PUT and the delete-dialog pattern.
  No layout or data-model change. A non-owner PUT already returns 404 (route
  scopes by `ownerId`), and the button is owner-only.

## Verification

- Owner opens a tree → sees the edit button; a sharee (view-only) does not.
- Clicking it opens a dialog pre-filled with the current name; Save disabled
  until the name is changed to a non-empty value.
- Renaming updates `treeMeta.name` immediately (verify the delete-confirm dialog
  and print filename now use the new name) with no manual refresh.
- `npm run lint`, `npm test`, `npm run build` pass.
