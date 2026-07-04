# Ancestor-Pedigree Default View — Design

Date: 2026-07-04

## Problem

Large family trees render every person at once. Navigation is hard. The user
wants the tree to open focused on one person's direct-ancestor line, with all
sideways (collateral) branches collapsed until deliberately expanded.

## Goals

- Main person = the earliest-created person in the tree (the "root"). Already
  the behaviour of `getRootPersonId`; no change.
- By default show only:
  - the root,
  - the root's **direct ancestors** (mother, father, grandparents,
    great-grandparents, … — the full pedigree),
  - the root's own **descendants** and **spouse(s)** (user decision: descendants
    stay visible by default).
- Collapse by default every **collateral** branch:
  - the root's siblings,
  - siblings of the mother/father (aunts/uncles),
  - siblings of grandparents (great-aunts/uncles),
  - siblings of every earlier ancestor generation.
- Each collateral branch expands only on explicit user action, and re-collapses.
- Keep the current visual appearance and layout. This changes *which nodes
  exist* and adds one control; it does not change layout math.

## Non-Goals (scoped out)

- **Cousins / descendants of collateral people.** Revealing an ancestor's
  siblings shows the sibling (and spouse, as a couple) only — the sibling's own
  children stay hidden. The user's requirement enumerated siblings per
  generation only. A future iteration can add downward drill-down.
- Changing layout algorithm, node styling, or the dagre/pedigree-fan math.

## Key Insight

The existing root-siblings feature (`rootSiblingsExpanded` boolean plus
`rootSlot` / `rootSiblingCount` plumbing across `buildTreeData` and the node
components) is a **special case** of the general rule "a person's siblings are
collapsed by default and expandable." Generalising it lets us delete the
root-only special-casing.

## Design

### Core visible set

Computed from the full person + relationship lists (BFS over `parent-child`):

```
core = {root}
     ∪ getAncestors(root)              // both parents each level → full pedigree
     ∪ getDescendants(root)
     ∪ spouses(root ∪ descendants)     // co-parents, so couples render
```

Spouses of **ancestors** are deliberately *not* blanket-added: both parents of
each generation are already ancestors, so ancestor couple nodes form on their
own. This avoids pulling in an ancestor's unrelated additional marriage.

Everyone not in `core` is **collateral** → hidden by default.

### Expansion state

New state in the tree page:

```ts
const [expandedSiblingIds, setExpandedSiblingIds] = useState<Set<string>>(new Set());
```

- Person IDs whose sibling group is currently revealed.
- Default empty ⇒ all collateral collapsed.
- Persisted to `localStorage` per tree (`tree-expanded-siblings-<treeId>`),
  mirroring the existing `tree-collapsed-<treeId>` load/save effects.
- **Replaces** `rootSiblingsExpanded` and its localStorage key.

### Hidden-set computation

```
revealed = ⋃ over id ∈ expandedSiblingIds of
             ( getSiblings(id) ∪ spouses(getSiblings(id)) )

visible  = core ∪ revealed
hidden   = allPersonIds − visible
```

The existing manual "hide ancestors" chevron (`collapsedPersonIds` +
`getAncestors`) is retained and unioned into `hidden` — it is orthogonal
(upward prune) to the collateral collapse (sideways). Decision confirmed with
user: keep both.

`visiblePersons` / `visibleRelationships` are filtered by `hidden` exactly as
today, then passed to `buildTreeData`.

### Sibling control (UI)

Per user choice: a **small +/− circle on the card edge**, replacing the current
root-only "+N siblings" pill.

- Appears on any visible spine person (root or ancestor) with
  `getSiblings(person).size > 0`.
- Shows the sibling count `N`.
- `+` icon when that person's siblings are collapsed, `−` when expanded.
- Click toggles the person's ID in `expandedSiblingIds`.
- `CoupleNode`: one control per partner slot that has siblings (mirrors the
  existing per-person collapse buttons at `left: 70` / `left: 290`).
- `PolyCoupleNode`: one control per occupied slot with siblings.

### Data flow

- **page.tsx** computes:
  - `coreVisibleIds` (via new helper),
  - `siblingCountById: Map<string, number>` for spine persons,
  - `hiddenIds` (rewritten as above),
  - `onToggleSiblings(personId)` callback,
  - passes `expandedSiblingIds`, `siblingCountById`, `onToggleSiblings` into
    `buildTreeData` (replacing the `rootSibling*` callback fields).
- **buildTreeData** attaches to each person/card: `siblingCount`,
  `siblingsExpanded`, `onToggleSiblings`. Removes `rootSlot`,
  `rootSiblingCount`, `rootSiblingsExpanded`, `onToggleRootSiblings`,
  `rootPersonId`.
- **Node components** render the control when `siblingCount > 0`.

### Toolbar

`expandAll` (already clears `collapsedPersonIds`) also sets `expandedSiblingIds`
to all spine persons that have siblings, so "Expand all" reveals everything.

## Files touched

- `lib/treeCollapse.ts` — add `getCoreVisible(root, relationships)` helper
  (spine + descendants + relevant spouses). `getSiblings`/`getAncestors`/
  `getDescendants` already exist.
- `app/(dashboard)/trees/[treeId]/page.tsx` — new state + localStorage effects,
  rewritten `hiddenIds`, `siblingCountById`, `onToggleSiblings`, updated
  `buildTreeData` call and `expandAll`.
- `lib/buildTreeData.ts` — swap root-sibling fields for per-person sibling
  fields on every node kind.
- `components/tree/PersonNode.tsx` — generalized control (was root-only).
- `components/tree/CoupleNode.tsx` — per-slot control (was root-only).
- `components/tree/PolyCoupleNode.tsx` — per-slot control.
- i18n `messages/{en,ka,he}.json` — tooltip keys
  (`showSiblings` / `hideSiblings`).

## Risks

- **Layout.** Revealed siblings are new child nodes of an ancestor couple; they
  reuse the existing parent-child edges and the dagre + pedigree-fan layout.
  Expected to place correctly, but must be verified on a real multi-generation
  tree for overlap.
- The `buildTreeData.ordering.test.ts` test references the changed fields —
  update if it asserts on `rootSibling*`.

## Verification

- Fresh load of a multi-generation tree shows only the pedigree spine +
  descendants; all aunts/uncles/great-aunts hidden.
- Each ancestor with siblings shows a `+N` circle; clicking reveals exactly that
  person's siblings and re-collapses on second click.
- State survives reload (localStorage).
- No node overlap after expanding several branches.
- `npm run lint`, `npm test`, `npm run build` pass.
