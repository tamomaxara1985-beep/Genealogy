# Ancestor Collapse Feature — Design Spec

**Date:** 2026-06-09  
**Status:** Approved

## Summary

Each person node in the family tree canvas gets a collapse/expand button. Clicking it hides all ancestors (parents, grandparents, etc.) of that person upward, reducing visual clutter for deep trees. Collapsed state persists per-tree in localStorage.

---

## Architecture / Data Flow

```
localStorage ──► collapsedPersonIds: Set<string>  (tree page state)
                        │
                        ▼
            getAncestors(ids, allRelationships)
                        │
                        ▼
            hiddenIds: Set<string>  (all ancestors of all collapsed persons)
                        │
                        ▼
            visiblePersons = persons.filter(p => !hiddenIds.has(p._id))
            visibleRels    = rels.filter(r => both sides visible)
                        │
                        ▼
            buildTreeData(visiblePersons, visibleRels, callbacks, highlighted)
                        │
                        ▼
            FamilyTree (dagre re-layouts with reduced node set)
```

`onToggleCollapse(personId)` flows through node data the same way `onAddRelative` does — no new props needed on `FamilyTree`.

---

## Collapse Logic

New utility: `lib/treeCollapse.ts`

```ts
export function getAncestors(
  personId: string,
  relationships: IRelationship[]
): Set<string> {
  const ancestors = new Set<string>();
  const queue = [personId];
  while (queue.length) {
    const cur = queue.shift()!;
    relationships
      .filter(r => r.type === "parent-child" && r.person2Id === cur)
      .forEach(r => {
        if (!ancestors.has(r.person1Id)) {
          ancestors.add(r.person1Id);
          queue.push(r.person1Id);
        }
      });
  }
  return ancestors;
}
```

In the tree page, `hiddenIds` is the union of `getAncestors(id, allRelationships)` for every `id` in `collapsedPersonIds`. Uses `allRelationships` (unfiltered) so BFS works correctly even when surname filter is active.

---

## UI — Button Placement

### PersonNode
- Small chevron button centered above the card, always visible (not only when selected)
- ChevronUp when expanded → click collapses ancestors
- ChevronDown when collapsed → click expands
- Size: ~20×20px circle, gray, `nodrag nopan` class
- When collapsed: show a faint `• • •` indicator above card to signal hidden ancestors exist

### CoupleNode
- One button per person, above each half of the couple card
- Left button above person1, right button above person2
- Same chevron logic per person

### Interaction
- Button click calls `onToggleCollapse(personId)` from node data
- Chevron direction driven by `isCollapsed: boolean` field in node data, computed as `collapsedPersonIds.has(person._id)` in tree page
- Only renders when `onToggleCollapse` is provided (same guard as `onAddRelative`)
- Button visible at all times (not gated on `selected` state) since collapse is a primary navigation action
- Button shows even if person has no ancestors (click is no-op; cleaner than conditional render)

---

## State & Persistence

```ts
// Initialize from localStorage
const [collapsedPersonIds, setCollapsedPersonIds] = useState<Set<string>>(() => {
  try {
    const stored = localStorage.getItem(`tree-collapsed-${treeId}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
});

// Sync to localStorage on change
useEffect(() => {
  localStorage.setItem(
    `tree-collapsed-${treeId}`,
    JSON.stringify([...collapsedPersonIds])
  );
}, [collapsedPersonIds, treeId]);

function toggleCollapse(personId: string) {
  setCollapsedPersonIds(prev => {
    const next = new Set(prev);
    next.has(personId) ? next.delete(personId) : next.add(personId);
    return next;
  });
}
```

- Key: `tree-collapsed-${treeId}` — scoped per tree
- Stale IDs (deleted persons) silently ignored — `getAncestors` returns empty set for unknown IDs

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `lib/treeCollapse.ts` | New — `getAncestors` utility |
| `app/(dashboard)/trees/[treeId]/page.tsx` | Add `collapsedPersonIds` state, `toggleCollapse`, `hiddenIds` computation, wire `onToggleCollapse` into node data callbacks |
| `lib/buildTreeData.ts` | Add `onToggleCollapse` + `collapsedPersonIds` to `Callbacks` interface; pass `isCollapsed` + `onToggleCollapse` into node data |
| `components/tree/PersonNode.tsx` | Add chevron button + collapsed indicator |
| `components/tree/CoupleNode.tsx` | Add per-person chevron buttons |

---

## Out of Scope

- Descendant collapse (downward direction)
- Server-side persistence of collapse state
- Collapse animation / transition
