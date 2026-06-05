# Sibling Layout & Linking Design

**Date:** 2026-06-05

## Problem

1. In the "Link People" dialog, there is no way to define two existing people as siblings.
2. In the family tree canvas, siblings (children of the same parent) appear at the same Y level but are not guaranteed to be adjacent — other nodes can appear between them.

## Goals

- Add "sibling" relationship option to the Link People dialog.
- Guarantee siblings are placed side by side in the tree canvas.
- No DB schema changes.

---

## Feature 1: Link People Dialog — Sibling via Shared Parent

### Behavior

When the user selects "sibling" as relationship type, a third dropdown appears: **Shared parent** (picks any existing person in the tree).

On submit, two `parent-child` relationships are created:
```
{ type: "parent-child", person1Id: parentId, person2Id: person1 }
{ type: "parent-child", person1Id: parentId, person2Id: person2 }
```

If either relationship already exists (same parent-child pair), it is skipped silently — the API already deduplicates.

### State changes (page.tsx)

| State | Before | After |
|---|---|---|
| `linkType` | `"parent-child" \| "spouse"` | `"parent-child" \| "spouse" \| "sibling"` |
| `linkParent` | — | `string` (new, personId of shared parent) |

### UI

- Relationship dropdown gains a "Sibling (shared parent)" option.
- When `linkType === "sibling"`, render a third `<Select>` labeled "Shared parent" filtered to exclude `linkP1` and `linkP2`.
- Submit button disabled until `linkP1`, `linkP2`, and `linkParent` are all set.

### Submit logic

```ts
if (linkType === "sibling") {
  // POST twice
  await fetch(`/api/trees/${treeId}/relationships`, {
    method: "POST",
    body: JSON.stringify({ type: "parent-child", person1Id: linkParent, person2Id: linkP1 }),
  });
  await fetch(`/api/trees/${treeId}/relationships`, {
    method: "POST",
    body: JSON.stringify({ type: "parent-child", person1Id: linkParent, person2Id: linkP2 }),
  });
}
```

### i18n

Add translation key `"sibling"` (and `"sharedParent"`) to `messages/en.json`, `messages/ka.json`, `messages/he.json` under the `tree` namespace.

### Files changed

- `app/(dashboard)/trees/[treeId]/page.tsx` — state, UI, submit logic
- `messages/en.json`, `messages/ka.json`, `messages/he.json` — new translation keys

---

## Feature 2: Tree Layout — Sibling Adjacency Post-Processing

### How dagre handles siblings today

Dagre with `rankdir: "TB"` places all children of a parent at the same rank (Y level). However, it does not guarantee children are placed adjacent to each other — intervening nodes from other branches can appear between siblings.

### Post-processing algorithm

After `dagre.layout(g)` runs in `treeLayout.ts`, add a second pass:

1. **Build childrenMap** — iterate edges, map `source → [target, ...]`
2. **For each parent**, collect its children's current dagre positions
3. **Sort children** by their current X position
4. **Compute group width**: `n × nodeWidth + (n-1) × nodesep` where nodesep = 60
5. **Center group** under parent's X: `startX = parent.x - groupWidth / 2`
6. **Reassign X** for each child evenly; Y is unchanged

### Node width lookup

- `coupleNode` → 200px
- `personNode` → 168px
- nodesep = 60 (matches current dagre config)

### Files changed

- `lib/treeLayout.ts` — ~25 lines added after `dagre.layout(g)` call

---

## Out of scope

- Sibling relationships between people who have no common parent in the tree (not supported by this design — user must pick an existing parent).
- Ordering siblings by birth date (not in scope; order is by current dagre X).
- Ordering siblings by birth date (not in scope; order follows current dagre X).
