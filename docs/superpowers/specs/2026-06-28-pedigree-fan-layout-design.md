# Per-Couple Pedigree Fan Layout

**Date:** 2026-06-28
**Status:** Approved design (supersedes 2026-06-28-root-couple-ancestor-split)

## Problem

For **every** couple, the husband's parents (and their whole ancestral subtree)
must sit to the **right** of the husband, and the wife's parents (and their
subtree) to the **left** of the wife — a classic pedigree fan. The previous
feature only shifted one coarse block for the single root couple, leaving every
other couple (e.g. Lina+Aron) with both parent-couples bunched to one side.

## Supersedes

This replaces the root-only approach. Remove from the layout path:
- `lib/treeAncestry.ts` `partitionRootAncestors` usage,
- the `layoutHints` carried for the root-only X-shift,
- the root-couple X-partition pass in `lib/treeLayout.ts`.

(`getRootPersonId` and the collapse-siblings feature are unrelated and stay.)

## Key idea

Keep dagre for **Y (generation rows)** and for descendants. Override **X only**
for the ancestor fan, computed by a recursive per-couple placement that keeps
each node's dagre Y.

## Inputs available to `applyDagreLayout`

- `nodes` with `id`, `type` (`coupleNode` / `polyCoupleNode` / `personNode`), widths.
- `edges` with `source` (ancestor/parent node), `target` (descendant/child node),
  and `targetHandle`. For a couple **child**, `targetHandle` begins with
  `person1-*` (wife/left card side) or `person2-*` (husband/right card side).
  For a person child it is `mother`/`father`.

## Algorithm

### 1. Parent resolution per node
For each `target` node T, from its incoming edges:
- `wifeParent(T)` = source of the edge whose `targetHandle` starts with `person1`.
- `husbandParent(T)` = source of the edge whose `targetHandle` starts with `person2`.
- For a `personNode` target (`mother`/`father` handles, one parent group): treat
  that single parent group as **centered** above (no split — a lone person has no
  husband/wife side). If desired later, father→right / mother→left; v1 centers it.
- For `polyCoupleNode` targets: place parents above without strict L/R split
  (documented limitation).

A parent "group" is whatever node holds those parents (usually a `coupleNode`).

### 2. Subtree width (memoized)
```
GAP = NODESEP (existing constant)
subtreeWidth(node):
  wp = wifeParent(node); hp = husbandParent(node)
  left  = wp ? subtreeWidth(wp) : 0
  right = hp ? subtreeWidth(hp) : 0
  if (!wp && !hp) return widthOf(node)
  return max(widthOf(node), left + GAP + right)
```
Memoize to avoid exponential blowup and to terminate on shared ancestors (a
`visited` guard returns the node's own width on re-entry).

### 3. Recursive placement (X only; Y stays dagre's)
```
placeFan(node, centerX, visited):
  if visited.has(node) return        // shared ancestor: place once
  visited.add(node)
  setX(node, centerX)                // keep dagre Y
  wp, hp as above
  if wp: placeFan(wp, centerX - GAP/2 - subtreeWidth(wp)/2, visited)  // LEFT
  if hp: placeFan(hp, centerX + GAP/2 + subtreeWidth(hp)/2, visited)  // RIGHT
```

### 4. Anchors
- **Anchor nodes** = nodes that are never an edge `source` (no children shown) —
  the youngest generation; the bottom of each fan.
- Each anchor keeps its **dagre X** as `centerX` (so any descendants dagre placed
  below stay aligned) and `placeFan` runs upward from it.
- Process anchors in ascending dagre X. Maintain a running right-edge cursor; if
  an anchor's fan (width `subtreeWidth(anchor)` centered on its X) would overlap
  the previous fan, shift this anchor's `centerX` right to clear it. Shared nodes
  already placed (in `visited`) are skipped, so overlapping family lines that
  share ancestors don't double-place.

### 5. Leftover nodes
Nodes never visited by any fan (pure descendants, isolated) keep their dagre
position unchanged.

## Files

- `lib/treeLayout.ts` — replace the root-couple X-partition pass with the
  pedigree fan (parent resolution, `subtreeWidth`, `placeFan`, anchor sweep).
  `applyDagreLayout` no longer needs `layoutHints`; drop the third param (or keep
  it ignored). Keep dagre, drop the now-redundant `HANDLE_ORDER` reorder pass
  (the fan subsumes it) — verify nothing else depends on it.
- `lib/buildTreeData.ts` — stop computing/returning `layoutHints` (revert to
  `{ nodes, edges }`), remove the `partitionRootAncestors` import.
- `components/tree/FamilyTree.tsx` — drop the `layoutHints` prop + `hintsKey`.
- `app/(dashboard)/trees/[treeId]/page.tsx` — drop `layoutHints` destructure/prop.
- `lib/treeAncestry.ts` — delete (no longer used).

## Verification

The layout is coordinate-checkable. Using the real DB tree(s), after layout
assert **for every `coupleNode`**: `x(husbandParent) > x(couple) > x(wifeParent)`
whenever both parents exist (and the single-sided cases on the correct side).
Iterate the algorithm until this holds. Then manual browser confirm on the
Makharashvili tree (Lina+Aron: Aron's parents right, Lina's left) and a tree with
descendants (no regression below couples).

## Known limitations (v1)

- Separate fans that don't share ancestors can still crowd horizontally; the
  anchor sweep shifts to reduce but does not globally minimize overlap.
- Shared ancestors (intermarriage) are placed once via the first path; the second
  relationship draws a longer edge.
- `polyCoupleNode` (2-spouse) parents are not strictly L/R split.
- Same/unknown-gender couples follow card position (person2 right, person1 left).
- Descendants below a couple stay on dagre's layout; only the upward cone fans.
