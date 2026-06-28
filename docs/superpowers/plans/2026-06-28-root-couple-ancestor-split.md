# Root-Couple Ancestor Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay out the root couple's male lineage to the right and female lineage to the left of the couple, fanning outward like a pedigree chart.

**Architecture:** A pure helper partitions the root couple's ancestors into right (male-side) and left (female-side) person sets. `buildTreeData` maps those to node-id sets and returns them as `layoutHints`. `applyDagreLayout` runs its normal dagre + existing X passes, then a final X-partition pass that shifts each side's ancestor block outward from the root couple's center. `FamilyTree` threads the hints through.

**Tech Stack:** TypeScript, dagre, @xyflow/react, React 19, Next.js 16. No test runner — pure helper verified with throwaway `npx tsx` check scripts; integration verified with `npm run build` + manual browser.

## Global Constraints

- Path alias `@/*` maps to project root. Import from `@/types`, `@/lib/...`.
- Approach A only: keep dagre for Y ranks + existing passes; add ONE post-pass that shifts X by a uniform per-side delta. Never change Y; never alter non-root-ancestor nodes.
- Scope: root couple only (root person = earliest `createdAt`, via existing `getRootPersonId`). Other couples unaffected.
- Side rule: male partner's ancestors → right; female partner's → left. Single root → father's line right, mother's line left. Same/unknown-gender couple → deterministic fallback (spouse right, root left). Shared ancestor (in both sets) → removed from both (stays centered).
- `buildTreeData` return becomes `{ nodes, edges, layoutHints }` — additive; existing destructures of `{ nodes, edges }` keep working.
- `layoutHints` shape: `{ rootCenterNodeId: string | null; rightAncestorNodeIds: Set<string>; leftAncestorNodeIds: Set<string> }`.
- Person→node mapping: `couplesByPerson.get(personId)?.[0] ?? personId` (couple/poly node id, else the person's own id for a personNode).

---

### Task 1: Pure helper — `partitionRootAncestors`

**Files:**
- Create: `lib/treeAncestry.ts`
- Check (temporary, not committed): `lib/treeAncestry.check.ts`

**Interfaces:**
- Consumes: `IPerson`, `IRelationship` from `@/types`.
- Produces: `partitionRootAncestors(rootPersonId: string | null, persons: IPerson[], relationships: IRelationship[]): { rightPersonIds: Set<string>; leftPersonIds: Set<string> }`.

- [ ] **Step 1: Write the failing check script**

Create `lib/treeAncestry.check.ts`:

```ts
import { partitionRootAncestors } from "./treeAncestry";
import type { IPerson, IRelationship } from "@/types";

let pid = 0;
function person(_id: string, gender: IPerson["gender"]): IPerson {
  return { _id, treeId: "t", firstName: _id, lastName: "x", gender, isLiving: true,
    createdAt: new Date(0) as unknown as Date, updatedAt: new Date(0) as unknown as Date };
}
function pc(person1Id: string, person2Id: string): IRelationship {
  return { _id: `pc${pid++}`, treeId: "t", type: "parent-child", person1Id, person2Id };
}
function sp(person1Id: string, person2Id: string): IRelationship {
  return { _id: `sp${pid++}`, treeId: "t", type: "spouse", person1Id, person2Id };
}

// Couple root: husband H + wife W. H's parents HF/HM, W's parents WF/WM, HF's father HGF.
const persons: IPerson[] = [
  person("H", "male"), person("W", "female"),
  person("HF", "male"), person("HM", "female"), person("HGF", "male"),
  person("WF", "male"), person("WM", "female"),
];
const rels: IRelationship[] = [
  sp("H", "W"),
  pc("HF", "H"), pc("HM", "H"), pc("HGF", "HF"),
  pc("WF", "W"), pc("WM", "W"),
];

const r1 = partitionRootAncestors("H", persons, rels);
console.assert(r1.rightPersonIds.has("HF") && r1.rightPersonIds.has("HM") && r1.rightPersonIds.has("HGF"),
  "male-side ancestors (incl grandparent) must be right");
console.assert(r1.rightPersonIds.size === 3, `right size 3, got ${r1.rightPersonIds.size}`);
console.assert(r1.leftPersonIds.has("WF") && r1.leftPersonIds.has("WM"), "female-side ancestors must be left");
console.assert(r1.leftPersonIds.size === 2, `left size 2, got ${r1.leftPersonIds.size}`);
console.assert(!r1.rightPersonIds.has("H") && !r1.leftPersonIds.has("W"), "seeds themselves excluded");

// Same result when root is the wife (gender still drives sides)
const r2 = partitionRootAncestors("W", persons, rels);
console.assert(r2.rightPersonIds.has("HF") && r2.leftPersonIds.has("WF"),
  "sides are gender-based regardless of which partner is root");

// Single root S with father SF and mother SM, SF's father SGF
const persons2: IPerson[] = [
  person("S", "male"), person("SF", "male"), person("SM", "female"), person("SGF", "male"),
];
const rels2: IRelationship[] = [ pc("SF", "S"), pc("SM", "S"), pc("SGF", "SF") ];
const r3 = partitionRootAncestors("S", persons2, rels2);
console.assert(r3.rightPersonIds.has("SF") && r3.rightPersonIds.has("SGF"), "single root: father + line right");
console.assert(r3.rightPersonIds.size === 2, `single right size 2, got ${r3.rightPersonIds.size}`);
console.assert(r3.leftPersonIds.has("SM") && r3.leftPersonIds.size === 1, "single root: mother left");

// Shared ancestor X is parent of both HF and WF -> excluded from both
const persons3: IPerson[] = [
  person("H", "male"), person("W", "female"),
  person("HF", "male"), person("WF", "male"), person("X", "male"),
];
const rels3: IRelationship[] = [
  sp("H", "W"), pc("HF", "H"), pc("WF", "W"), pc("X", "HF"), pc("X", "WF"),
];
const r4 = partitionRootAncestors("H", persons3, rels3);
console.assert(!r4.rightPersonIds.has("X") && !r4.leftPersonIds.has("X"), "shared ancestor excluded from both");

// Empty / null
const r5 = partitionRootAncestors(null, persons, rels);
console.assert(r5.rightPersonIds.size === 0 && r5.leftPersonIds.size === 0, "null root -> empty");

console.log("ALL CHECKS PASSED");
```

- [ ] **Step 2: Run the check to verify it fails**

Run: `npx tsx lib/treeAncestry.check.ts`
Expected: FAIL — `partitionRootAncestors` not exported.

- [ ] **Step 3: Create `lib/treeAncestry.ts`**

```ts
import type { IPerson, IRelationship } from "@/types";

// BFS upward from seedId through parent-child edges. Excludes seedId.
function ancestorsOf(seedId: string, parentChildRels: IRelationship[]): Set<string> {
  const result = new Set<string>();
  const queue = [seedId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const r of parentChildRels) {
      if (r.person2Id === cur && !result.has(r.person1Id) && r.person1Id !== seedId) {
        result.add(r.person1Id);
        queue.push(r.person1Id);
      }
    }
  }
  return result;
}

/**
 * Partition the root couple's ancestry into right (male-side) and left
 * (female-side) person-id sets. Shared ancestors (reachable from both) are
 * removed from both. Returns empty sets when the root cannot be resolved.
 */
export function partitionRootAncestors(
  rootPersonId: string | null,
  persons: IPerson[],
  relationships: IRelationship[]
): { rightPersonIds: Set<string>; leftPersonIds: Set<string> } {
  const empty = { rightPersonIds: new Set<string>(), leftPersonIds: new Set<string>() };
  if (!rootPersonId) return empty;
  const byId = new Map(persons.map((p) => [p._id, p]));
  const root = byId.get(rootPersonId);
  if (!root) return empty;

  const parentChildRels = relationships.filter((r) => r.type === "parent-child");

  let rightPersonIds: Set<string>;
  let leftPersonIds: Set<string>;

  const spouseRel = relationships.find(
    (r) =>
      r.type === "spouse" &&
      (r.person1Id === rootPersonId || r.person2Id === rootPersonId)
  );

  if (spouseRel) {
    // Couple root: sides = each partner's ancestors, by gender.
    const spouseId =
      spouseRel.person1Id === rootPersonId ? spouseRel.person2Id : spouseRel.person1Id;
    const spouseGender = byId.get(spouseId)?.gender;
    let rightSeed: string;
    let leftSeed: string;
    if (root.gender === "male") { rightSeed = rootPersonId; leftSeed = spouseId; }
    else if (root.gender === "female") { leftSeed = rootPersonId; rightSeed = spouseId; }
    else if (spouseGender === "male") { rightSeed = spouseId; leftSeed = rootPersonId; }
    else if (spouseGender === "female") { leftSeed = spouseId; rightSeed = rootPersonId; }
    else { rightSeed = spouseId; leftSeed = rootPersonId; } // same/unknown fallback
    rightPersonIds = ancestorsOf(rightSeed, parentChildRels);
    leftPersonIds = ancestorsOf(leftSeed, parentChildRels);
  } else {
    // Single root: father's line right, mother's line left (seed + its ancestors).
    rightPersonIds = new Set<string>();
    leftPersonIds = new Set<string>();
    for (const r of parentChildRels) {
      if (r.person2Id !== rootPersonId) continue;
      const parent = byId.get(r.person1Id);
      if (!parent) continue;
      if (parent.gender === "male") {
        rightPersonIds.add(r.person1Id);
        ancestorsOf(r.person1Id, parentChildRels).forEach((a) => rightPersonIds.add(a));
      } else if (parent.gender === "female") {
        leftPersonIds.add(r.person1Id);
        ancestorsOf(r.person1Id, parentChildRels).forEach((a) => leftPersonIds.add(a));
      }
    }
  }

  // Drop shared ancestors from both sides.
  for (const id of [...rightPersonIds]) {
    if (leftPersonIds.has(id)) { rightPersonIds.delete(id); leftPersonIds.delete(id); }
  }
  return { rightPersonIds, leftPersonIds };
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `npx tsx lib/treeAncestry.check.ts`
Expected: prints `ALL CHECKS PASSED`.

- [ ] **Step 5: Delete the check script and commit**

```bash
rm lib/treeAncestry.check.ts
git add lib/treeAncestry.ts
git commit -m "feat: partitionRootAncestors layout helper"
```

---

### Task 2: `buildTreeData` returns `layoutHints`

**Files:**
- Modify: `lib/buildTreeData.ts`

**Interfaces:**
- Consumes: `partitionRootAncestors` (Task 1); `callbacks.rootPersonId` (already on the `Callbacks` interface from prior work); the internal `couplesByPerson` map.
- Produces: `buildTreeData` return type becomes `{ nodes: AnyNode[]; edges: TreeEdge[]; layoutHints: LayoutHints }` where
  `LayoutHints = { rootCenterNodeId: string | null; rightAncestorNodeIds: Set<string>; leftAncestorNodeIds: Set<string> }`.

- [ ] **Step 1: Add the import**

At the top of `lib/buildTreeData.ts`, add:

```ts
import { partitionRootAncestors } from "@/lib/treeAncestry";
```

- [ ] **Step 2: Export the `LayoutHints` type**

Near the top of the file (after the existing `type AnyNode = ...` line), add:

```ts
export type LayoutHints = {
  rootCenterNodeId: string | null;
  rightAncestorNodeIds: Set<string>;
  leftAncestorNodeIds: Set<string>;
};
```

- [ ] **Step 3: Compute hints just before the final return**

The function currently ends with:

```ts
  const nodes: AnyNode[] = [...coupleNodes, ...polyCoupleNodes, ...personNodes];
  return { nodes, edges };
}
```

Replace those two lines with:

```ts
  const nodes: AnyNode[] = [...coupleNodes, ...polyCoupleNodes, ...personNodes];

  const nodeIdOf = (personId: string) =>
    couplesByPerson.get(personId)?.[0] ?? personId;

  const { rightPersonIds, leftPersonIds } = partitionRootAncestors(
    callbacks.rootPersonId ?? null,
    persons,
    relationships
  );
  const layoutHints: LayoutHints = {
    rootCenterNodeId: callbacks.rootPersonId ? nodeIdOf(callbacks.rootPersonId) : null,
    rightAncestorNodeIds: new Set([...rightPersonIds].map(nodeIdOf)),
    leftAncestorNodeIds: new Set([...leftPersonIds].map(nodeIdOf)),
  };

  return { nodes, edges, layoutHints };
}
```

- [ ] **Step 4: Verify the build is green**

Run: `npm run build`
Expected: PASS. The return change is additive — `page.tsx` destructures `{ nodes, edges }` and ignores the new field, so no consumer breaks yet.

- [ ] **Step 5: Commit**

```bash
git add lib/buildTreeData.ts
git commit -m "feat: buildTreeData returns root-ancestor layoutHints"
```

---

### Task 3: X-partition pass in `applyDagreLayout`

**Files:**
- Modify: `lib/treeLayout.ts`

**Interfaces:**
- Consumes: the `LayoutHints` shape (structural — declared inline here to avoid a circular import with `buildTreeData`).
- Produces: `applyDagreLayout(nodes, edges, layoutHints?)` — optional third parameter; behavior unchanged when omitted.

- [ ] **Step 1: Add a `GAP` constant and a layout-hints param type**

Below the existing `const RANKSEP = 220;` line, add:

```ts
const SIDE_GAP = 200; // clearance between the root couple center and each lineage block

type LayoutHintsInput = {
  rootCenterNodeId: string | null;
  rightAncestorNodeIds: Set<string>;
  leftAncestorNodeIds: Set<string>;
};
```

- [ ] **Step 2: Extend the signature**

Change:

```ts
export function applyDagreLayout<T extends MinimalNode>(
  nodes: T[],
  edges: MinimalEdge[]
): T[] {
```

to:

```ts
export function applyDagreLayout<T extends MinimalNode>(
  nodes: T[],
  edges: MinimalEdge[],
  layoutHints?: LayoutHintsInput
): T[] {
```

- [ ] **Step 3: Add the X-partition pass after the handle-ordering pass**

Immediately before the final `// Convert center positions to top-left for React Flow` comment block, insert:

```ts
  // Root-couple ancestor split: shift the male-side ancestor block right of the
  // couple center and the female-side block left. Uniform per-side delta keeps
  // each block's internal arrangement and all Y ranks intact.
  if (layoutHints?.rootCenterNodeId) {
    const centerPosRoot = centerPos.get(layoutHints.rootCenterNodeId);
    if (centerPosRoot) {
      const centerX = centerPosRoot.x;
      const widthOf = (id: string) => {
        const t = nodeById.get(id)?.type;
        return t === "polyCoupleNode" ? POLY_COUPLE_W : t === "coupleNode" ? COUPLE_W : PERSON_W;
      };

      // Right block: push so its leftmost edge clears centerX + SIDE_GAP.
      const rightIds = [...layoutHints.rightAncestorNodeIds].filter((id) => centerPos.has(id));
      if (rightIds.length) {
        let minLeftEdge = Infinity;
        rightIds.forEach((id) => {
          const x = centerPos.get(id)!.x;
          minLeftEdge = Math.min(minLeftEdge, x - widthOf(id) / 2);
        });
        const delta = Math.max(0, centerX + SIDE_GAP - minLeftEdge);
        if (delta > 0) {
          rightIds.forEach((id) => {
            const cur = centerPos.get(id)!;
            centerPos.set(id, { x: cur.x + delta, y: cur.y });
          });
        }
      }

      // Left block: push so its rightmost edge clears centerX - SIDE_GAP.
      const leftIds = [...layoutHints.leftAncestorNodeIds].filter((id) => centerPos.has(id));
      if (leftIds.length) {
        let maxRightEdge = -Infinity;
        leftIds.forEach((id) => {
          const x = centerPos.get(id)!.x;
          maxRightEdge = Math.max(maxRightEdge, x + widthOf(id) / 2);
        });
        const delta = Math.min(0, centerX - SIDE_GAP - maxRightEdge);
        if (delta < 0) {
          leftIds.forEach((id) => {
            const cur = centerPos.get(id)!;
            centerPos.set(id, { x: cur.x + delta, y: cur.y });
          });
        }
      }
    }
  }

```

- [ ] **Step 4: Verify the build is green**

Run: `npm run build`
Expected: PASS. The new parameter is optional; the existing `FamilyTree` call (two args) still typechecks.

- [ ] **Step 5: Commit**

```bash
git add lib/treeLayout.ts
git commit -m "feat: ancestor X-partition pass in applyDagreLayout"
```

---

### Task 4: Thread `layoutHints` through `FamilyTree` and the tree page

**Files:**
- Modify: `components/tree/FamilyTree.tsx`
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

**Interfaces:**
- Consumes: `layoutHints` from the `buildTreeData` result (Task 2); `applyDagreLayout`'s optional third param (Task 3).
- Produces: feature is live end-to-end.

- [ ] **Step 1: Add the `layoutHints` prop to `FamilyTree`**

In `components/tree/FamilyTree.tsx`, import the type and extend `Props`. Change the import block to add:

```ts
import type { TreeEdge } from "@/types";
import type { LayoutHints } from "@/lib/buildTreeData";
```

Change the `Props` interface:

```ts
interface Props {
  nodes: AnyNode[];
  edges: TreeEdge[];
  layoutHints?: LayoutHints;
}
```

- [ ] **Step 2: Use the prop in the layout memo**

Change the component signature and the `layoutNodes` memo. Replace:

```ts
export function FamilyTree({ nodes: rawNodes, edges: rawEdges }: Props) {
  // Derive stable ID keys so useMemo deps are simple expressions
  const nodeIds = rawNodes.map((n) => n.id).join(",");
  const edgeIds = rawEdges.map((e) => e.id).join(",");

  const layoutNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges),
    // Re-layout only when node/edge IDs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeIds, edgeIds]
  );
```

with:

```ts
export function FamilyTree({ nodes: rawNodes, edges: rawEdges, layoutHints }: Props) {
  // Derive stable ID keys so useMemo deps are simple expressions
  const nodeIds = rawNodes.map((n) => n.id).join(",");
  const edgeIds = rawEdges.map((e) => e.id).join(",");
  const hintsKey =
    `${layoutHints?.rootCenterNodeId ?? ""}|` +
    `${[...(layoutHints?.rightAncestorNodeIds ?? [])].sort().join(",")}|` +
    `${[...(layoutHints?.leftAncestorNodeIds ?? [])].sort().join(",")}`;

  const layoutNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges, layoutHints),
    // Re-layout only when node/edge IDs or layout hints change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeIds, edgeIds, hintsKey]
  );
```

- [ ] **Step 3: Pass `layoutHints` from the page**

In `app/(dashboard)/trees/[treeId]/page.tsx`, change the `buildTreeData` destructure. Replace:

```ts
  const { nodes, edges } = buildTreeData(
```

with:

```ts
  const { nodes, edges, layoutHints } = buildTreeData(
```

(the call arguments are unchanged).

- [ ] **Step 4: Pass the prop to `<FamilyTree>`**

Replace:

```tsx
        <FamilyTree nodes={nodes} edges={edges} />
```

with:

```tsx
        <FamilyTree nodes={nodes} edges={edges} layoutHints={layoutHints} />
```

- [ ] **Step 5: Verify the build is green**

Run: `npm run build`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add components/tree/FamilyTree.tsx "app/(dashboard)/trees/[treeId]/page.tsx"
git commit -m "feat: wire root-ancestor layoutHints into the tree canvas"
```

---

### Task 5: Manual browser verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run `npm run dev` (background). Open `http://localhost:3000`, log in, open a tree where the root person (first-added) is in a male/female couple and BOTH partners have at least one parent (ideally a grandparent on at least one side).

- [ ] **Step 2: Verify the split**

Expected: the male partner's parents/grandparents sit to the right of the couple; the female partner's sit to the left. The two lineages fan outward, not interleaved over the center.

- [ ] **Step 3: Verify single-root case**

Open/inspect a tree whose root person has no spouse but has a father and mother. Expected: father's line to the right, mother's line to the left.

- [ ] **Step 4: Verify no-ancestor / no-root cases**

A tree where the root has no parents, or an empty/again-filtered tree. Expected: layout identical to before (no crash, no shift).

- [ ] **Step 5: Verify no regression**

Descendants below the couple, sibling nodes, and the collapse-siblings badge all behave as before. Ancestor-collapse chevrons still work.

- [ ] **Step 6: Stop the dev server.**

---

## Self-Review

**Spec coverage:**
- Partition into right/left by gender, couple + single + same-gender fallback + shared-ancestor exclusion → Task 1 `partitionRootAncestors`. ✓
- Map person sets → node-id sets + `rootCenterNodeId`, return `layoutHints` → Task 2. ✓
- Post-dagre X-partition shift, uniform per-side delta, Y preserved, root-couple only → Task 3. ✓
- Thread hints through FamilyTree + page, re-layout on hint change → Task 4. ✓
- Edge cases (no root, no parents, single root, same-gender, shared ancestor) → Task 1 logic + Task 3 guards + Task 5 manual checks. ✓
- Approach A (reuse dagre + existing passes) → Task 3 inserts after existing passes, before coordinate conversion. ✓
- No DB/API changes → none present. ✓

**Placeholder scan:** No TBD/TODO/vague steps — every code step shows full code. ✓

**Type consistency:** `LayoutHints`/`LayoutHintsInput` fields identical (`rootCenterNodeId`, `rightAncestorNodeIds`, `leftAncestorNodeIds`) across Tasks 2–4; `partitionRootAncestors` signature matches between Task 1 (definition) and Task 2 (call); `applyDagreLayout` third param optional in Task 3, supplied in Task 4. ✓

**Note:** `lib/treeLayout.ts` declares the hints shape inline (`LayoutHintsInput`) rather than importing `LayoutHints` from `buildTreeData`, to avoid a circular import (`buildTreeData` → `treeLayout` is the existing direction). The two shapes are structurally identical; TypeScript structural typing makes the Task 4 call typecheck.
