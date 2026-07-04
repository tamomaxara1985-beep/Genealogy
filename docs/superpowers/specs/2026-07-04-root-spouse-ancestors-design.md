# Show Root's Spouse's Ancestors (In-law Pedigree) — Design

Date: 2026-07-04

## Problem

The default tree shows the main person's (root's) spouse card, but not the
spouse's parents, grandparents, or other relatives. `getCoreVisible` includes
the spouse **card** (spouse of any visible person) but never the spouse's
**ancestors**, so the in-law pedigree is invisible.

## Goal

Show the ancestor pedigree (parents, grandparents, …) of the **root's**
spouse(s), symmetric with the root's own line. The in-law collateral (spouse's
siblings, in-law great-aunts/uncles) is collapsed by default and expandable via
the existing +N sibling badge — same behavior as the root's line.

## Non-Goals

- In-laws of every married-in person throughout the tree (chosen scope: root's
  spouse only).
- Any layout change — the root-couple two-sided ancestor fan already exists.
- Showing in-law collateral expanded by default.

## Design

### Helper (`lib/treeCollapse.ts`)

Add `getSpouses(personId, relationships): Set<string>` — the partner ids from
`spouse` relationships touching `personId`. Reused by both changes below.

### `getCoreVisible` (`lib/treeCollapse.ts`)

After the existing root + ancestors + descendants seeding, and before/independent
of the existing spouse-card step, add each of the root's spouses and their
ancestors:

```ts
for (const sp of getSpouses(rootId, relationships)) {
  core.add(sp);
  getAncestors(sp, relationships).forEach((id) => core.add(id));
}
```

`getAncestors` returns both parents at each level, so the spouse's father+mother
form a couple that fans upward on the spouse's side. The existing snapshot-based
"spouse of any core member" step remains (keeps co-parents/other spouse cards
visible) and does not cascade to spouses-of-spouses.

### `spineIds` (`app/(dashboard)/trees/[treeId]/page.tsx`)

`spineIds` currently `{root} ∪ getAncestors(root)` — the set whose members get a
sibling **+N** badge (via `siblingInfo`). Extend it to also include each root
spouse and that spouse's ancestors:

```ts
// after adding root + getAncestors(root)
getSpouses(rootId, relationships).forEach((sp) => {
  s.add(sp);
  getAncestors(sp, relationships).forEach((id) => s.add(id));
});
```

So the in-law line's collateral collapses by default and expands via the same
badge/`expandedSiblingIds` machinery as the root's line. `hiddenIds` already
hides non-core persons and reveals expanded siblings, so no other change is
needed there.

### Result

The root couple renders with the root's pedigree fanning up one side and the
spouse's pedigree up the other (existing two-sided fan). In-law collateral is
collapsed-by-default, expandable.

## Files touched

- `lib/treeCollapse.ts` — add `getSpouses`; extend `getCoreVisible`; add tests.
- `app/(dashboard)/trees/[treeId]/page.tsx` — `spineIds` includes the root
  spouse line.

## Risk

- Low; visibility-only, reusing the existing two-sided ancestor fan and the
  collapse/sibling machinery. Verify the spouse's parents fan on the spouse's
  side (edges route through the root couple's `person1`/`person2` handles) and
  that a root with multiple spouses (poly/multi node) shows each spouse's
  pedigree.

## Verification

- Open a tree whose root has a spouse with recorded parents → the spouse's
  parents/grandparents now appear on the spouse's side of the root couple.
- In-law siblings are hidden by default; the spouse (and each in-law ancestor)
  shows a +N badge that reveals them.
- Root's own line unchanged; a root with no spouse or a spouse with no recorded
  parents degrades gracefully (nothing extra shown).
- `npm run lint`, `npm test`, `npm run build` pass.
