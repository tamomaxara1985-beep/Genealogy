# Multiple Spouses in the Tree — Design

Date: 2026-07-04

## Problem

A person with more than two spouses does not render their extra spouses.
`buildTreeData` builds a `polyCoupleNode` only when a person has **exactly two**
spouse relationships; the first marriage otherwise becomes a `coupleNode`. With
three or more spouse relationships (e.g. Vladimer Makharashvili has five spouse
rels — named Tamar Karelidze and Rusudan Karapetiani plus placeholder "unknown"
persons), the poly branch is skipped, only the first pairing forms a couple, the
remaining spouses drop out as disconnected person cards, and **their children
mis-route to the first couple's handle**.

The user wants every additional spouse to appear, connected, with that
marriage's children under the correct pairing — everywhere in the tree, not just
this one case.

## Goals

- Any person with 3+ spouses renders all spouses, each connected by a marriage
  line, with each marriage's children hanging under that specific pairing.
- Additional spouses are visible wherever the shared person is visible —
  including when the shared person is an ancestor (currently their extra spouses
  are hidden by the pedigree-collapse rule).
- Preserve the existing look for the common cases: **1 spouse → `coupleNode`**
  and **exactly 2 spouses → `polyCoupleNode`** are unchanged.

## Non-Goals

- Redesigning the 1- and 2-spouse rendering (kept as-is to avoid regressions).
- Deduplicating placeholder/"unknown" spouse persons — they are real person
  records and render as normal cards with "?" initials.
- Showing the extra spouse's own ancestors (only the spouse card is added to the
  view, not their family line).

## Design

### Node kinds (by spouse count of a person)

| Spouses | Node | Change |
|---|---|---|
| 1 | `coupleNode` | unchanged |
| 2 | `polyCoupleNode` (shared centered, one spouse each side) | unchanged |
| ≥3 | **`multiCoupleNode`** (new) | shared person on the LEFT, spouses fanned to the right |

`multiCoupleNode` layout (width = 600 was fixed for poly; multi is dynamic):

```
[SHARED] ─♥─ [spouse 1]
         ─♥─ [spouse 2]
         ─♥─ [spouse 3] …
```

- Shared person card at the left. Each spouse card in a single horizontal row to
  its right. A marriage connector runs from the shared person to **each** spouse
  (fanned) — no line is drawn between two spouses, so no false spouse↔spouse
  marriage is implied.
- Divorced marriages use the existing dashed + `÷` marker (per-marriage
  `isDivorced`/`divorceDate`).
- One **source handle per marriage** at the bottom, positioned under that
  spouse, so `buildTreeData` can route each child edge to the pairing that
  produced it.

### buildTreeData

- Group spouse rels per person (dedup by spouse id). Ordering: by marriage
  `startDate` when present, else by relationship document order (stable,
  deterministic).
- Person with ≥3 distinct spouses → one `multiCoupleNode` carrying
  `{ shared, marriages: [{ spouse, isDivorced, divorceDate, handleId }] }`.
  Mark the shared person and all spouses as "in a couple" so they are not also
  emitted as lone person nodes.
- Keep the existing exactly-2 poly branch and the single-spouse couple branch.
- Child-edge routing: extend the existing poly routing map so a child of the
  shared person + spouse N resolves to `multiCoupleNode` id + that marriage's
  handle id. Fall back to the shared person's node when the co-parent is
  unknown.

### Visibility (`getCoreVisible`)

Currently core-visible = root + ancestors + descendants + spouses of
**root/descendants only** (ancestors' extra spouses excluded). Change: include
the spouse of **any** core-visible person (ancestors included). Only the spouse
person is added — not the spouse's ancestors. This makes 2nd/3rd spouses show
wherever their partner is visible.

### Layout (`treeLayout.ts`)

`widthOfType` returns a fixed width per node type. The multi node's width varies
with spouse count, so layout must read a per-node width for `multiCoupleNode`:
`SHARED_W + n × (CONNECTOR_W + SPOUSE_W)`. Options: attach the computed width to
the node's `data`/`style` and have `widthOf` prefer it, or recompute from the
marriage count in the node data. The existing `enforceRowGaps` min-gap pass then
spaces multi nodes against neighbors as usual. Dagre also needs the correct
width (`g.setNode(... width)`), so the width must be available before layout.

### FamilyTree / signature

Register `multiCoupleNode` in `nodeTypes`. Extend `nodesContentSignature` to
include the shared + all spouse persons and per-marriage divorce flags of a
multi node, so edits repaint (consistent with the existing content-signature
fix).

## Files touched

- `components/tree/MultiCoupleNode.tsx` — new node component (create).
- `components/tree/FamilyTree.tsx` — register node type.
- `lib/buildTreeData.ts` — ≥3-spouse branch, per-marriage child routing.
- `lib/treeLayout.ts` — dynamic width for `multiCoupleNode`.
- `lib/treeCollapse.ts` — `getCoreVisible` includes spouses of all visible persons.
- `lib/treeNodesSignature.ts` — cover `multiCoupleNode`.

## Risk

- Largest tree change to date: dynamic node width + N marriage handles + layout
  + visibility all interact. Must verify:
  - Vladimer (5 spouse rels incl. placeholders) shows all spouses, children of
    each marriage under the right spouse.
  - 1-spouse couples and exactly-2-spouse poly nodes are visually **identical**
    to before.
  - No overlaps (the min-gap pass must account for the wider multi node).
  - Adding a spouse still updates live (edge-signature + content-signature).

## Verification

- Open the tree with Vladimer: all spouses visible, each marriage's children
  under the correct pairing; divorced marriages marked.
- A person with exactly 1 and exactly 2 spouses render unchanged.
- An ancestor's 2nd spouse now appears (visibility change).
- `npm run lint`, `npm test` (existing + new), `npm run build` pass; manual
  browser check.
