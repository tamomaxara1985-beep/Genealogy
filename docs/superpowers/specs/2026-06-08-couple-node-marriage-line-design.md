# CoupleNode Marriage Line Redesign

**Date:** 2026-06-08  
**Status:** Approved

## Goal

Restyle `CoupleNode` from a single combined card (two halves separated by a divider) to two separate PersonCard boxes connected by a horizontal amber marriage line with a ♥ symbol. Preserves the single-React-Flow-node approach for layout stability.

## Visual Structure

```
      [▼ Handle:Top (centered across full width)]

  ┌──────────┐                    ┌──────────┐
  │  [Photo] │  ───── ♥ ─────    │  [Photo] │
  │  Tariel  │                   │  Алла    │
  │ 1951–17  │                   │  1954    │
  └──────────┘                    └──────────┘

      [▲ Handle:Bottom (centered across full width)]
```

- Each card: identical styling to `PersonNode` — gender-colored border (blue/pink/purple/gray), avatar with living dot, first name, last name, birth/death dates.
- Marriage line: `1.5px` amber (`#f59e0b`) horizontal line with a `♥` symbol centered.
- React Flow node: still a single `CoupleNode`. Handles remain at top/bottom center of the full combined width.

## Files Changed

### `components/tree/CoupleNode.tsx`

Full restyle. Replace the single-bordered flex container with:

```
<div className="flex items-center gap-0">
  <PersonCard person={person1} ... />
  <MarriageLine />
  <PersonCard person={person2} ... />
</div>
```

- `PersonCard` (internal component): renders avatar, name, dates, gender border — same as `PersonNode` card. Width: `160px`.
- `MarriageLine` (internal component): `60px` wide, renders `1.5px` amber `<hr>` or CSS border with centered `♥` overlaid.
- Top color bar removed (gender border on each card conveys same info).
- Add buttons:
  - "Add father" → `absolute -top-9 left-0` (above left card)
  - "Add mother" → `absolute -top-9 right-0` (above right card)
  - "Add son" / "Add daughter" → `absolute -bottom-9` centered (unchanged)

### `lib/treeLayout.ts`

```diff
- const COUPLE_W = 200;
+ const COUPLE_W = 380;  // 160 (card) + 60 (gap) + 160 (card)
```

All references to `COUPLE_W` (node registration, sibling repositioning, position conversion) pick up the new value automatically — no other changes needed.

## Constraints

- No changes to `buildTreeData.ts` — CoupleNode creation logic unchanged.
- No changes to edge types — parent-child smoothstep edges unchanged.
- `PersonNode.tsx` unchanged.
- `FamilyTree.tsx` unchanged.
- Scope: visual restyle only. No drag-apart behavior, no separate node routing.

## Success Criteria

- Married couple displays as two distinct cards with a ♥ marriage line between them.
- Children's edges drop from the center-bottom handle correctly.
- Parent edges connect to center-top handle correctly.
- "Add father/mother/son/daughter" buttons appear in correct positions when node is selected.
- Dagre layout spaces couple nodes with correct width, no overlap with adjacent nodes.
