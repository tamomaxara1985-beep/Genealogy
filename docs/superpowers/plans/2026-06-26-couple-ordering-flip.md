# Couple Ordering Flip (Father Right / Mother Left) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the family-tree couple layout so the father (male) is shown on the **right** and the mother (female) on the **left**, both within a couple card and in the parent generation above any child.

**Architecture:** The convention lives in five coordinated spots — slot assignment in `buildTreeData.ts`, horizontal parent ordering in `treeLayout.ts`, and the physical top-handle X positions in the three node components. All five must change together; a partial change desyncs edge routing from card rendering. This is therefore one atomic task with one commit (no broken intermediate state).

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, `@xyflow/react`, dagre, Tailwind CSS v4.

## Global Constraints

- No new dependencies.
- No changes to the database schema, API routes, or `types/index.ts`.
- Tailwind classes only — no inline `style` except for the pixel-precise React Flow handle offsets already in use.
- `"use client"` already present in the node components — do not add or remove it.
- No automated test runner is configured (Playwright e2e only, unused). Verification is `npm run build` + manual smoke checks, matching the repo's existing plans.

## Background — current vs target

Current convention (father LEFT):
- `buildTreeData.ts`: swaps so `person1` = male, `person2` = female. `coupleSlot`: person1→1, person2→2.
- `treeLayout.ts` `HANDLE_ORDER`: `person1-father`/`father` = 0 (leftmost) … father ordered left of mother.
- Node top-handles: `*-father` handle sits at the smaller X (left), `*-mother` at the larger X (right).
- `CoupleNode`/`PolyCoupleNode` render `person1`/`leftSpouse` first (left card).

Target convention (father RIGHT):
- `person1` = female (left card), `person2` = male (right card). Render order unchanged → male lands on the right.
- `HANDLE_ORDER`: mother ordered left of father.
- `*-father` handle moves to the larger X (right), `*-mother` to the smaller X (left).

Two independent "father on the right" requirements, both satisfied: (1) husband on the right of a couple card, (2) a person's father drawn to the right in the generation above them.

---

### Task 1: Flip the father/mother convention across all five spots

**Files:**
- Modify: `lib/buildTreeData.ts`
- Modify: `lib/treeLayout.ts`
- Modify: `components/tree/PersonNode.tsx`
- Modify: `components/tree/CoupleNode.tsx`
- Modify: `components/tree/PolyCoupleNode.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: same `{ nodes, edges }` shape from `buildTreeData`; same node `data` shapes. No caller or type changes. Handle **ids** are unchanged (`person1-father`, `mother`, etc.) — only their X positions and dagre ordering flip.

---

- [ ] **Step 1: `lib/buildTreeData.ts` — flip the regular-couple swap rule**

Find this line (inside the `spouseRels.filter(...).forEach(...)` block, ~line 141):

```ts
      if (p1.gender === "female" && p2.gender === "male") [p1, p2] = [p2, p1];
```

Replace with (so the **female** becomes `person1`/left, the **male** becomes `person2`/right):

```ts
      if (p1.gender === "male" && p2.gender === "female") [p1, p2] = [p2, p1];
```

Leave everything else in the file unchanged. `coupleSlot` (person1→1, person2→2), the `targetHandle` string construction, and the poly-couple block stay as-is — the handle **ids** do not change, only which gender occupies which slot.

- [ ] **Step 2: `lib/treeLayout.ts` — reverse `HANDLE_ORDER` so mother is left of father**

Find the `HANDLE_ORDER` map (~lines 14–21):

```ts
const HANDLE_ORDER: Record<string, number> = {
  "person1-father": 0,
  "father": 0,
  "person1-mother": 1,
  "mother": 1,
  "person2-father": 2,
  "person2-mother": 3,
};
```

Replace with (mother gets the lower X order within each child's parent pair; father the higher):

```ts
const HANDLE_ORDER: Record<string, number> = {
  "person1-mother": 0,
  "mother": 0,
  "person1-father": 1,
  "father": 1,
  "person2-mother": 2,
  "person2-father": 3,
};
```

- [ ] **Step 3: `components/tree/PersonNode.tsx` — swap father/mother top-handle X positions and add-button sides**

Find the two target handles (~lines 67–69):

```tsx
      {/* father = left quarter, mother = right quarter of 160px card */}
      <Handle type="target" position={Position.Top} id="father" style={{ left: 40 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="mother" style={{ left: 120 }} className="!bg-gray-300 !w-2 !h-2" />
```

Replace with (mother left, father right):

```tsx
      {/* mother = left quarter, father = right quarter of 160px card */}
      <Handle type="target" position={Position.Top} id="mother" style={{ left: 40 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="father" style={{ left: 120 }} className="!bg-gray-300 !w-2 !h-2" />
```

Then find the `ADD_BUTTONS` entries (~lines 19–20):

```tsx
  { role: "father",   label: "Add father",   pos: "top-left" },
  { role: "mother",   label: "Add mother",   pos: "top-right" },
```

Replace with (so "Add father" sits on the right, "Add mother" on the left, matching the new convention):

```tsx
  { role: "mother",   label: "Add mother",   pos: "top-left" },
  { role: "father",   label: "Add father",   pos: "top-right" },
```

- [ ] **Step 4: `components/tree/CoupleNode.tsx` — swap father/mother handle X within each card**

Find the four target handles (~lines 128–133):

```tsx
      {/* 4 target handles: father(left) + mother(right) above each card */}
      {/* person1 card spans 0–160px, person2 card spans 220–380px */}
      <Handle type="target" position={Position.Top} id="person1-father" style={{ left: 40 }}  className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person1-mother" style={{ left: 120 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person2-father" style={{ left: 260 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person2-mother" style={{ left: 340 }} className="!bg-gray-300 !w-2 !h-2" />
```

Replace with (mother handle on the left of each card, father handle on the right; ids unchanged):

```tsx
      {/* 4 target handles: mother(left) + father(right) above each card */}
      {/* person1 card spans 0–160px, person2 card spans 220–380px */}
      <Handle type="target" position={Position.Top} id="person1-mother" style={{ left: 40 }}  className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person1-father" style={{ left: 120 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person2-mother" style={{ left: 260 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person2-father" style={{ left: 340 }} className="!bg-gray-300 !w-2 !h-2" />
```

Leave the rest of `CoupleNode.tsx` unchanged. Card render order (`person1` left, `person2` right), the parent-add buttons, collapse buttons, and `•••` indicators stay — `person1` is now the mother and `person2` the father, so the male card already renders on the right with no further edits.

- [ ] **Step 5: `components/tree/PolyCoupleNode.tsx` — swap father/mother handle X within each group**

Find the six target handles (~lines 112–118):

```tsx
      {/* Target handles (top) — 2 per person */}
      <Handle type="target" position={Position.Top} id="left-father"   style={{ left:  40 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="left-mother"   style={{ left: 120 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="shared-father" style={{ left: 260 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="shared-mother" style={{ left: 340 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="right-father"  style={{ left: 480 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="right-mother"  style={{ left: 560 }} className="!bg-gray-300 !w-2 !h-2" />
```

Replace with (within each person's pair, mother handle on the left, father handle on the right; ids unchanged):

```tsx
      {/* Target handles (top) — 2 per person; mother left, father right */}
      <Handle type="target" position={Position.Top} id="left-mother"   style={{ left:  40 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="left-father"   style={{ left: 120 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="shared-mother" style={{ left: 260 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="shared-father" style={{ left: 340 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="right-mother"  style={{ left: 480 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="right-father"  style={{ left: 560 }} className="!bg-gray-300 !w-2 !h-2" />
```

Leave the rest of `PolyCoupleNode.tsx` unchanged — the poly node stays centered on the shared (multi-spouse) person; only the per-person father/mother handle sides flip for consistency.

- [ ] **Step 6: Verify the build compiles**

Run: `npm run build`
Expected: build completes with no TypeScript errors. Fix any errors before continuing.

- [ ] **Step 7: Manual smoke test — regular couple (father right)**

1. Run `npm run dev` and open `http://localhost:3000`.
2. Open a tree containing a male+female couple.
3. Expected: the **female** card is on the **left**, the **male** card on the **right**, joined by the marriage line.
4. Expected: their children still connect from the couple's bottom handle down to each child — no dangling/crossed edges.

- [ ] **Step 8: Manual smoke test — separate parents ordering (father right)**

1. Find (or create via the node "Add father"/"Add mother" buttons) a child whose father and mother are **separate** nodes (not joined as a couple).
2. Expected: the **mother** node sits to the **left** and the **father** node to the **right** above the child, with edges entering the child's left (mother) and right (father) top handles — lines not crossed.

- [ ] **Step 9: Manual smoke test — poly couple (person with 2 spouses)**

1. Open a tree with a person who has two spouses (renders as the wide `PolyCoupleNode`, shared person centered).
2. Expected: the node still renders with the shared person centered and both marriages intact.
3. Expected: each spouse's own parents (if present) enter their card with mother-left / father-right, and children of each marriage still connect from the correct source handle.

- [ ] **Step 10: Commit**

```bash
git add lib/buildTreeData.ts lib/treeLayout.ts components/tree/PersonNode.tsx components/tree/CoupleNode.tsx components/tree/PolyCoupleNode.tsx
git commit -m "feat: flip couple layout to father-right / mother-left"
```

---

## Self-Review

**Spec coverage:** Part 1 of the design spec (couple ordering flip) is fully covered by Task 1, touching exactly the four files the spec names (`buildTreeData.ts`, `treeLayout.ts`, `CoupleNode.tsx`, `PolyCoupleNode.tsx`) plus `PersonNode.tsx` (the spec's "single child" handle case, necessary for separate-parent ordering). Parts 2–4 are intentionally out of scope — they ship in Plan B.

**Placeholder scan:** No TBD/TODO; every step shows exact before/after code and exact commands.

**Type consistency:** No type or signature changes. Handle ids (`person1-father`, `mother`, `left-father`, etc.) are preserved everywhere; only X positions and `HANDLE_ORDER` values change, so `buildTreeData`'s `targetHandle` strings continue to match the rendered handle ids.
