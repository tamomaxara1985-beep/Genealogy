# Focus-Anchored Tree with Overflow Auto-Collapse — Design Spec

**Date:** 2026-06-26
**Status:** Proposed

## Summary

Two improvements to the family-tree canvas, driven by readability/clutter:

1. **Couple ordering flip** — father shown on the **right**, mother on the **left** (currently the reverse).
2. **Overflow auto-collapse** — when the laid-out tree is larger than the canvas (raw pixels at zoom 1), automatically collapse the branches **farthest from a focus person** until it fits. The focus person is the logged-in user's own record ("this is me"). Auto-hidden branches show an expand affordance; manual expansions are remembered and exempt from re-collapse.

Implemented in two phases (user decision):
- **Plan A** — Part 1 (ordering flip). Independent, low-risk, ships first.
- **Plan B** — Parts 2–4 (focus person + auto-collapse engine + expand UI).

---

## Part 1 — Couple Ordering Flip (Plan A)

### Current behavior
- `buildTreeData.ts`: `if (p1.gender === "female" && p2.gender === "male") swap` → male becomes `person1` (slot 1 = left), female `person2` (slot 2 = right). Father LEFT, mother RIGHT.
- `treeLayout.ts` `HANDLE_ORDER`: `person1-father`/`father` = 0 (leftmost), mother handles to the right.
- `CoupleNode.tsx` renders `person1` (left card) then `person2` (right card). `PolyCoupleNode.tsx` renders `leftSpouse / shared / rightSpouse`.

### Target behavior
Father RIGHT, mother LEFT. Flip consistently in all four spots so data, layout x-ordering, and visual rendering agree:

| File | Change |
|------|--------|
| `lib/buildTreeData.ts` | Swap rule so **mother → slot 1 (left)**, **father → slot 2 (right)**. Update poly-couple left/right spouse assignment so the male/father lands on the right. Edge `targetHandle` father/mother mapping unchanged in name; only physical side flips via layout + node render. |
| `lib/treeLayout.ts` | Reverse `HANDLE_ORDER` so **mother x < father x** (mother handles get the lower order numbers, father handles the higher). |
| `components/tree/CoupleNode.tsx` | Swap visual card order, marriage-line handle positions, and the parent-add buttons so the left card = mother, right card = father. |
| `components/tree/PolyCoupleNode.tsx` | Mirror the left/right spouse rendering + handle offsets to match the flipped convention. |

### Risk / verification
- Regression risk: edge routing to the correct parent handle. Verify a known couple renders mother-left/father-right and children still connect to the correct parent handles. Verify poly-couple (person with 2 spouses) still routes children correctly.
- No data model, API, or `types/index.ts` change.

---

## Part 2 — Focus Person ("this is me") (Plan B)

### Behavior
- One focus person per tree. Used purely as the anchor for Part 3's auto-collapse priority (branches nearest the focus survive longest).
- **Set:** "Set as me" action in the person detail dialog (`trees/[treeId]/page.tsx`).
- **Persist:** localStorage key `tree-root-${treeId}` (string personId). Matches the existing collapse-persistence pattern; zero backend/schema change. (A `rootPersonId` field on the `Tree` model is a possible future upgrade if cross-device persistence is wanted.)
- **Fallback when unset / stale id:** oldest person — earliest `birthDate`; if none have a birthDate, the first-created person (`createdAt`). Deterministic so auto-collapse is stable before the user picks anyone.

### Data flow
```
localStorage tree-root-${treeId} ──► focusPersonId (page state, with fallback)
                                          │
                                          ▼
                         passed to FamilyTree + autoCollapse
```

---

## Part 3 — Overflow Auto-Collapse (Plan B)

### Definition of "doesn't fit"
**Raw pixel overflow** (user decision): the dagre-laid-out bounding box at zoom 1 exceeds the canvas container's pixel size. Goal is to keep the tree readable near 1:1 rather than letting `fitView` shrink nodes to illegibility.

### Module: `lib/autoCollapse.ts`
Pure function:
```ts
computeAutoHidden(
  persons: IPerson[],
  relationships: IRelationship[],
  focusId: string,
  containerW: number,
  containerH: number,
  pinned: Set<string>,        // manual-expand exemptions
): Set<string>                 // personIds to hide
```

Algorithm:
1. **Distance map** — BFS from `focusId` over the relationship graph (both `parent-child` and `spouse` edges, undirected) → `dist: Map<personId, number>`. Persons unreachable from focus get `Infinity`.
2. **Trim loop:**
   - Build candidate visible set = all persons minus current hidden.
   - Run `applyDagreLayout` on the candidate set's nodes/edges; compute bounding box `(maxX+w) − minX`, `(maxY+h) − minY`.
   - If `bboxW ≤ containerW && bboxH ≤ containerH` → done.
   - Else identify the **frontier**: visible persons with the greatest `dist` (excluding `focusId`, its core ancestral line, and any `pinned`). Remove that whole distance-rank batch (batching limits the number of relayouts), re-layout, repeat.
   - Stop if nothing further is removable (only focus core + pinned remain) even if still overflowing — never hide the focus or pinned.
3. Return the accumulated hidden set.

Performance: trees are small (hundreds of nodes); dagre is synchronous and runs without rendering. Batch-by-distance keeps relayout count ≈ tree depth.

### Wiring (`FamilyTree.tsx` + page)
- `FamilyTree` measures its container via `ResizeObserver` → reports `(w, h)` up (callback prop) or computes auto-collapse internally. Container size is only known inside the rendered component, so measurement lives there.
- Recompute `autoHiddenIds` when: container size changes (debounced ~150ms), or `persons`/`relationships`/`focusId` change.
- Merge into existing pipeline in `page.tsx`:
  ```
  finalHidden = manualCollapsedAncestors ∪ autoHidden − pinned
  visiblePersons = persons.filter(p => !finalHidden.has(p._id))
  ```
  `buildTreeData` contract unchanged.

---

## Part 4 — Expand Affordance + Manual Override (Plan B)

- A visible node that borders one or more **auto-hidden** relatives shows a `[+N]` badge (N = count of hidden direct neighbors). Extends the existing `•••`/chevron indicator in `PersonNode.tsx` and `CoupleNode.tsx`.
- **Click** → reveal those neighbors and add them to `pinned` (localStorage `tree-pinned-${treeId}`), so the next resize/auto-collapse pass will not re-hide them.
- Existing manual ancestor-collapse (`collapsedPersonIds` → `getAncestors`) is unchanged and composes: a user can still manually collapse ancestors.
- Final visibility rule (single source of truth in `page.tsx`):
  ```
  hidden = getAncestorsOfAll(collapsedPersonIds) ∪ autoHidden
  hidden = hidden − pinned
  ```

---

## Files Touched

### Plan A
| File | Change |
|------|--------|
| `lib/buildTreeData.ts` | Flip slot assignment (mother left, father right); poly spouse side |
| `lib/treeLayout.ts` | Reverse `HANDLE_ORDER` |
| `components/tree/CoupleNode.tsx` | Swap card/handle/button sides |
| `components/tree/PolyCoupleNode.tsx` | Mirror spouse sides |

### Plan B
| File | Change |
|------|--------|
| `lib/autoCollapse.ts` | New — distance BFS + trim loop |
| `components/tree/FamilyTree.tsx` | ResizeObserver, report container size / drive auto-collapse |
| `app/(dashboard)/trees/[treeId]/page.tsx` | focusPersonId state + localStorage, pinned state, merge into hidden pipeline, "Set as me" action |
| `components/tree/PersonNode.tsx` | `[+N]` expand badge for hidden neighbors |
| `components/tree/CoupleNode.tsx` | `[+N]` expand badge per person |
| `lib/treeCollapse.ts` | Possibly extend with neighbor helpers (count hidden direct neighbors) |

---

## Out of Scope
- Cross-device persistence of focus/pinned (localStorage only for now).
- Pedigree-only default view (rejected in favor of full tree + overflow auto-collapse).
- Server-side persistence; DB schema changes.
- Collapse animations.

---

## Constraints
- No new dependencies (dagre + React Flow already present).
- TypeScript strict; Tailwind classes only (inline `style` only for pixel-precise handle offsets).
- `cn()` for className composition.
- `@/*` path alias.
