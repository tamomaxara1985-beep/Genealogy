# Multiple Spouses Design

**Date:** 2026-06-22  
**Status:** Approved

## Problem

A person with multiple marriages (e.g. first wife deceased, second wife and her children) cannot be modelled. `buildTreeData.ts` has a single-use gate (`usedInCouple` Set, line 33) that skips any spouse relationship after the first. The second wife never gets a CoupleNode; her children cannot be linked to both parents.

## Chosen Approach

Each marriage becomes its own independent CoupleNode. The shared person (grandfather) has their card data duplicated inside each CoupleNode. This is the standard approach used by Ancestry and FamilySearch.

```
[Wife1 ♥ Grandfather]    [Grandfather ♥ Wife2]
  child1  child2            child3  child4
```

No changes to CoupleNode component shape. Layout algorithm already handles multiple coupleNodes correctly.

## Files Changed

### 1. `lib/buildTreeData.ts` — core algorithm

**Remove** the single-use gate:
```typescript
// REMOVE:
if (usedInCouple.has(r.person1Id) || usedInCouple.has(r.person2Id)) return;
```

**Replace** tracking structures:
```typescript
// OLD: usedInCouple + coupleByPersonId + coupleSlot
// NEW:
const personInAnyCouple = new Set<string>();          // for PersonNode filtering only
const coupleByPair = new Map<string, string>();        // "p1|p2" → coupleNodeId
const couplesByPerson = new Map<string, string[]>();   // personId → [coupleNodeId, ...]
const coupleSlot = new Map<string, 1 | 2>();           // personId → slot (unchanged — slot is gender-determined, consistent across all couples)
```

Every spouse relationship creates a CoupleNode. Both persons added to `personInAnyCouple`.

**Replace** `nodeId()` with `sourceNodeId(parentId, childId)`:
```typescript
// Build parents-per-child map before edge loop
const parentsByChild = new Map<string, string[]>();
parentChildRels.forEach(r => {
  const arr = parentsByChild.get(r.person2Id) ?? [];
  arr.push(r.person1Id);
  parentsByChild.set(r.person2Id, arr);
});

function sourceNodeId(parentId: string, childId: string): string {
  for (const otherId of (parentsByChild.get(childId) ?? [])) {
    if (otherId === parentId) continue;
    const coupleId = coupleByPair.get(`${parentId}|${otherId}`);
    if (coupleId) return coupleId;
  }
  return couplesByPerson.get(parentId)?.[0] ?? parentId;
}
```

Routing logic:
- Child with two known parents → finds the CoupleNode containing both → correct marriage unit
- Child with one known parent → falls back to that parent's first CoupleNode (or bare PersonNode if not in any couple)

`coupleSlot` lookup must also use the new key scheme (`coupleId|personId`) since a person can now appear in multiple couples with different slot positions.

### 2. `components/tree/CoupleNode.tsx` — add "Add spouse" button

Each PersonCard inside CoupleNode needs an "Add spouse" button when the node is selected. This allows adding a second spouse to either person in the couple.

Add to the selected-state action block (alongside existing parent buttons):
```tsx
<button onClick={() => onAddRelative(person1._id, "spouse")}>
  + {person1.firstName}'s spouse
</button>
<button onClick={() => onAddRelative(person2._id, "spouse")}>
  + {person2.firstName}'s spouse
</button>
```

Positioned alongside the existing parent-add buttons above each card.

## Data Layer

No changes. `Relationship` schema has no uniqueness constraint on spouse pairs. The API POST endpoint creates relationships with no limit. `buildParentOptions` in the tree page already loops all spouse relationships for a person (lines 81–101) — parent selection for new children already supports multiple marriages.

## Out of Scope

- Divorce date display between couple nodes of the same person (existing `isDivorced` / `divorceDate` on IRelationship already supports this)
- Ordering of marriages by date (marriages render in the order relationships were created)
- Preventing duplicate spouse relationships (same two people married twice) — no guard needed at this stage
