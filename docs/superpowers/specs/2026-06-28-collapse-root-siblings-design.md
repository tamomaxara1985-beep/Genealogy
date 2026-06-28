# Collapse Root Person's Siblings by Default

**Date:** 2026-06-28
**Status:** Approved design

## Problem

The family tree canvas gets visually cluttered. The user wants the root person's
mother and father to stay visible while the root person's siblings are hidden
(collapsed) by default, with the ability to expand them on demand.

## Existing system (context)

A collapse mechanism already exists but works in the **opposite direction**:

- Each node has a top-center chevron that hides the person's **ancestors**
  (everyone upward), via `getAncestors(personId, relationships)` in
  `lib/treeCollapse.ts`.
- Default is **off** (nothing collapsed).
- State lives in `collapsedPersonIds: Set<string>`, persisted to
  `localStorage` key `tree-collapsed-${treeId}`.
- Hidden IDs are computed into `hiddenIds` and filtered out of `visiblePersons` /
  `visibleRelationships` before `buildTreeData`.

This feature adds a **downward, default-on** collapse scoped to one person's
siblings. It is additive — the existing ancestor-collapse is untouched.

## Decisions

- **Focal person** = the tree's root / home person.
- **Root person** = the person with the earliest `createdAt` (first added).
  Derived purely client-side; no schema, API, or DB change. `createdAt` is
  already present on `IPerson` and returned by the persons API.
- **Siblings** = anyone sharing **at least one** parent with the root
  (full siblings + half siblings), excluding the root itself.
- **What hides** = each sibling **plus that sibling's descendant subtree**
  (so a sibling's children don't dangle parentless).
- **Default** = siblings collapsed (hidden).
- **Expand control** = a chevron + count badge on the root person's node.
- **Persistence** = a single boolean `rootSiblingsExpanded` per tree in
  `localStorage` (key `tree-root-siblings-${treeId}`), default `false`.

## Components

### 1. `lib/treeCollapse.ts` (extend)

Add two pure functions alongside `getAncestors`:

- `getDescendants(personId, relationships): Set<string>` — BFS **downward**
  through `parent-child` edges (mirror of `getAncestors`; follows
  `r.person1Id === cur` to collect `r.person2Id`). Excludes `personId`.
- `getSiblings(rootId, relationships): Set<string>` — collect the root's
  parents (all `person1Id` where `person2Id === rootId`), then collect every
  `person2Id` that shares any of those parents. Exclude `rootId`. This yields
  full + half siblings.

### 2. `lib/treeRoot.ts` (new)

- `getRootPersonId(persons: IPerson[]): string | null` — returns the `_id` of
  the person with the smallest `createdAt`; `null` if the list is empty.
  Compare via `new Date(p.createdAt).getTime()`.

### 3. Tree page — `app/(dashboard)/trees/[treeId]/page.tsx`

- New state `rootSiblingsExpanded: boolean`, default `false`.
- Load/save it to `localStorage` key `tree-root-siblings-${treeId}` using the
  same mount-effect / write-effect pattern as `collapsedPersonIds`.
- Derive `rootId = getRootPersonId(persons)`.
- Derive `rootSiblingIds = getSiblings(rootId, relationships)` (empty if no root).
- When `!rootSiblingsExpanded`, compute `hiddenSiblingIds` as the union of each
  sibling ID and `getDescendants(siblingId, relationships)`; merge into the
  existing `hiddenIds` set. When expanded, contribute nothing.
- `toggleRootSiblings` callback flips `rootSiblingsExpanded`.
- Pass into `buildTreeData` callbacks: `rootPersonId`, `rootSiblingCount`
  (= `rootSiblingIds.size`), `rootSiblingsExpanded`, `onToggleRootSiblings`.

### 4. `lib/buildTreeData.ts`

- Extend `Callbacks` with `rootPersonId?`, `rootSiblingCount?`,
  `rootSiblingsExpanded?`, `onToggleRootSiblings?`.
- Forward these to the node whose person is the root:
  - PersonNode: when `person._id === rootPersonId`.
  - CoupleNode: when `person1._id` or `person2._id === rootPersonId` (mark which
    card is root).
- Only forward when `rootSiblingCount > 0` so non-root nodes and zero-sibling
  roots render no badge.

### 5. Node UI — `PersonNode.tsx` + `CoupleNode.tsx`

- On the root person's card only, render a small pill to the **side** of the
  card (not top-center — that position already holds the ancestor-collapse
  chevron). Pill shows a chevron and the hidden-sibling count (e.g. `▸ 3` when
  collapsed, `▾` when expanded).
- Click → `onToggleRootSiblings()`. Use `nodrag nopan` and
  `e.stopPropagation()` like the existing node buttons.
- Reuse the amber hover styling of existing node buttons for visual
  consistency.

## Data flow

```
persons (with createdAt)
  └─ getRootPersonId → rootId
relationships
  └─ getSiblings(rootId) → rootSiblingIds
       └─ (if collapsed) ∪ getDescendants(sib) → hiddenSiblingIds
            └─ merged into hiddenIds
                 └─ filters visiblePersons / visibleRelationships
                      └─ buildTreeData → nodes/edges (root node gets badge)
```

## Edge cases

- **Root has no parents** → `getSiblings` returns empty → no badge, nothing
  hidden.
- **Root has 0 siblings** → `rootSiblingCount === 0` → no badge.
- **Root in a CoupleNode** → badge attaches to the root's specific card.
- **Empty tree** → `getRootPersonId` returns `null`; feature inert.
- **Sibling subtree overlaps the main line** (e.g. a sibling married a direct
  ancestor — rare) → that node may be hidden while collapsed; acceptable for v1,
  not specially handled.
- **Ancestor-collapse interaction** → both contribute to the same `hiddenIds`
  set; union semantics, no conflict.

## Out of scope (YAGNI)

- No "Set as home person" UI; root is strictly first-added.
- No per-couple downward collapse (explicitly rejected).
- No DB/API persistence of root or expansion state (localStorage only).
- No animation beyond the existing re-layout `fitView`.

## Testing

- Manual: tree where root has siblings → siblings hidden on load, parents
  visible; badge shows count; click expands; reload preserves collapsed default
  unless toggled (state persists per toggle).
- Manual: root with no siblings / no parents → no badge.
- Manual: ancestor-collapse still works independently.
