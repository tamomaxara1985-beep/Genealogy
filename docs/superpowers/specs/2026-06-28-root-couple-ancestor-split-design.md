# Root-Couple Ancestor Split (Male Right / Female Left)

**Date:** 2026-06-28
**Status:** Approved design

## Problem

In a couple node the female renders on the left card and the male on the right
(per the gender swap in `buildTreeData`). The user wants the **male's ancestral
lineage drawn to his right** and the **female's lineage to her left**, so the
two family lines fan outward from the root couple like a classic pedigree chart.
Today dagre centers all ancestors above their children and does not keep each
lineage on its own side, so deeper ancestors (grandparents and up) drift across.

## Scope

- Applies to the **root couple only** (the root person + spouse). All other
  couples lay out normally.
- Affects only the **ancestor cone** above the root couple. Descendants,
  siblings, and unrelated nodes are untouched.
- Root person = earliest-created person (existing `getRootPersonId`).

## Decisions

### Seeds and sides
- **Root in a couple:** right side = the **male** partner's ancestors; left side
  = the **female** partner's ancestors.
- **Root single (no spouse):** center on the root person; right = root's
  **father** + father's ancestors; left = root's **mother** + mother's
  ancestors.
- **Same-gender or unknown-gender couple:** fall back to rendered card position
  — the right card's lineage goes right, the left card's goes left. (Limitation.)
- **Shared ancestor** reachable from both seeds (e.g. cousin marriage): left
  centered — excluded from both side-shifts. (Limitation.)

### Layout strategy (Approach A — post-dagre X-partition)
Keep dagre for generation rows (Y) and the overall tree. Reuse the existing
post-processing pattern in `lib/treeLayout.ts` (sibling-centering and
handle-ordering already post-adjust X). Add ONE new pass that shifts each side's
ancestor block outward by a uniform per-side delta, preserving dagre's internal
arrangement and all Y ranks.

Rejected alternatives:
- **B (dedicated pedigree sub-layout):** higher fidelity but requires stitching
  multiple layouts and aligning generation rows; more code than warranted.
- **C (bias dagre with ordering constraints/weights):** dagre fights directional
  side constraints; fragile and unreliable.

## Components

### 1. `lib/treeAncestry.ts` (new, pure)

`partitionRootAncestors(rootPersonId, persons, relationships): { rightPersonIds: Set<string>; leftPersonIds: Set<string> }`

- Resolve the root person and their spouse (first `spouse` relationship).
- Determine the two seeds and their sides per the Decisions above.
- BFS upward through `parent-child` edges from each seed to collect that side's
  ancestor person IDs.
- Remove any person present in both sets (shared ancestor) from both.
- Returns empty sets if the root cannot be resolved (empty tree, etc.).

### 2. `lib/buildTreeData.ts`

- Map the right/left **person** sets to **node-id** sets. A parent couple node
  is wholly one side (both partners belong to the same lineage branch), so the
  partition is clean at the node level — the only node holding both sides is the
  root couple itself, which is the center and belongs to neither side-set.
- Use the existing `couplesByPerson` map (person → node id), falling back to the
  person's own id for a `personNode`.
- Identify `rootCenterNodeId` = the node containing the root person.
- Return a `layoutHints` object alongside `nodes`/`edges`:
  `{ rootCenterNodeId: string | null; rightAncestorNodeIds: Set<string>; leftAncestorNodeIds: Set<string> }`.
- When there is no root or no ancestors, `layoutHints` is present but with a null
  center and empty sets (layout falls back to current behavior).

### 3. `lib/treeLayout.ts`

- `applyDagreLayout(nodes, edges, layoutHints?)` — new optional third parameter.
- After the existing sibling-centering and handle-ordering passes, run the
  X-partition pass:
  - `centerX` = `centerPos` x of `rootCenterNodeId`. If missing, skip the pass.
  - Right block = nodes whose id is in `rightAncestorNodeIds`. Compute the block's
    minimum **left edge** (`x - width/2`). `delta = max(0, (centerX + GAP) - minLeftEdge)`;
    add `delta` to every right-block node's x.
  - Left block = nodes in `leftAncestorNodeIds`. Compute the block's maximum
    **right edge** (`x + width/2`). `delta = min(0, (centerX - GAP) - maxRightEdge)`;
    add `delta` (negative) to every left-block node's x.
  - `GAP` = a fixed margin (≈ half the couple width) so the two lineages clear
    the center couple.
- Pass preserves Y for all nodes and the relative arrangement inside each block.

### 4. `components/tree/FamilyTree.tsx`

- Accept `layoutHints` (from the `buildTreeData` result) as a prop.
- Pass it into `applyDagreLayout(rawNodes, rawEdges, layoutHints)`.
- Extend the `useMemo` dependency key so a change in the hints (root or
  partition) re-triggers layout. Key on `rootCenterNodeId` plus the sorted
  joined node-id sets (stable string), consistent with the existing
  id-string keying.

## Data flow

```
rootPersonId + persons + relationships
  └─ partitionRootAncestors → { rightPersonIds, leftPersonIds }
       └─ buildTreeData maps person sets → node-id sets + rootCenterNodeId  →  layoutHints
            └─ applyDagreLayout: dagre (Y ranks) → sibling-centering → handle-ordering → X-partition shift
                 └─ FamilyTree renders shifted positions
```

## Edge cases

- **No root / empty tree** → null center, empty sets → layout unchanged.
- **Root has no parents and no spouse** → both sets empty → layout unchanged.
- **Root single with one parent** → only that parent's side populated; other side
  empty (no shift).
- **Single root with an `other`/`unknown`-gender parent** → that parent's lineage
  is assigned to neither side and stays centered (no shift). The single-root split
  is strictly male→right / female→left; there is no fallback for non-binary parent
  gender. Degrades gracefully (centered, no crash).
- **Same-gender / unknown-gender couple** → deterministic fallback: the **spouse**
  is treated as the right seed and the **root person** as the left seed. This is a
  fixed root-vs-spouse rule; the helper does **not** read the rendered card slot,
  so the visual side may not correspond to card position for same-gender couples.
- **Shared ancestor** → excluded from both sides, stays centered.
- **Collapsed siblings (existing feature)** → ancestors are not hidden by the
  collapse feature, so the partition still sees them; the two features compose.

## Known limitations (v1)

- Uniform per-side block shift does not run a global de-overlap; very deep
  lineages or unrelated nodes on the same row can still crowd.
- Same-gender / unknown-gender couples use a deterministic spouse-right / root-left
  rule, not gender and not rendered card position — the visual side may not match
  the card slot for these couples.
- `other`/`unknown`-gender parents of a single (spouse-less) root are left centered
  (no side assignment).
- Shared ancestors are left centered rather than assigned to a side.
- Root couple only — other couples are unaffected.

## Testing

- Pure helper `partitionRootAncestors`: throwaway `npx tsx` check (no test runner
  in repo) covering couple root, single root (father/mother split), shared
  ancestor exclusion, and empty/no-parent cases.
- Layout pass: manual browser verification — male lineage sits right of the root
  couple, female lineage left; descendants unchanged; no regression when there is
  no root or no ancestors.
