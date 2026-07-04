# Multiple Spouses (3+) Tree Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every spouse of a person with 3+ spouses as one horizontal multi-spouse node (shared person first, spouse cards following, a marriage marker per spouse, each marriage's children under that spouse), and make additional spouses visible wherever their partner is visible.

**Architecture:** Add a `multiCoupleNode` (dynamic width) for persons with ≥3 distinct spouses; keep `coupleNode` (1 spouse) and `polyCoupleNode` (exactly 2) unchanged. `buildTreeData` builds it and routes each child edge to the correct marriage's source handle. `treeLayout` reads the multi node's dynamic width. `getCoreVisible` includes the spouse of any visible person.

**Tech Stack:** Next.js 16, React 19, TypeScript, `@xyflow/react` (React Flow) + dagre, vitest.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/components/...`, `@/types`.
- Node tooltips/labels stay hardcoded English (repo convention; no i18n in tree nodes).
- Card width = 160px (`w-40`); marriage connector slot = 60px — MATCH the existing `CoupleNode`/`PolyCoupleNode` geometry exactly.
- Do NOT change `coupleNode` (1 spouse) or `polyCoupleNode` (exactly 2 spouses) behavior/appearance.
- Couple gender ordering (female-left/male-right) and the `enforceRowGaps` min-gap pass must keep working.
- Run `npm test` after touching tested lib code (repo has vitest).
- Emerald accent: `emerald-*`; destructive/divorce marker reuse the existing dashed `÷` pattern from `CoupleNode`.

## Multi node geometry (reference for all tasks)

For a `multiCoupleNode` with `marriages.length === n`:
- Width = `160 + 220 * n`.
- Cards left→right: shared `[0..160]`; then for marriage `k` (0-based): connector `[160+220k .. 220+220k]`, spouse card `[220+220k .. 380+220k]`.
- Spouse `k` card center x = `300 + 220*k`.
- **Target handles (top):** shared → id `"shared"` at x `80`; spouse `k` → id `spouse${k}` at x `300+220*k`.
- **Source handles (bottom):** marriage `k` → id `m${k}` at x `300+220*k` (children hang under that spouse).

---

### Task 1: `getCoreVisible` includes spouses of every visible person

**Files:**
- Modify: `lib/treeCollapse.ts`
- Test: `lib/treeCollapse.test.ts`

**Interfaces:**
- Produces: `getCoreVisible(rootId, relationships)` now adds the spouse of ANY core member (root, ancestors, descendants), not just root+descendants. Only the spouse person is added, not the spouse's ancestors.

- [ ] **Step 1: Add a failing test**

Append to `lib/treeCollapse.test.ts`:

```ts
  it("includes an ancestor's additional spouse (spouse of any visible person)", () => {
    // dad is an ancestor of root; dad has a second spouse 'stepmom'
    const rels = [pc("dad", "root"), sp("dad", "stepmom")];
    expect(getCoreVisible("root", rels).has("stepmom")).toBe(true);
  });
```

> NOTE: an existing test asserts the OPPOSITE ("excludes an ancestor's non-ancestor extra spouse"). That test encodes the old pedigree-collapse rule the spec now reverses. DELETE that old test (`it("excludes an ancestor's non-ancestor extra spouse", ...)`) — the spec change intentionally makes ancestor spouses visible.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- treeCollapse`
Expected: the new "includes an ancestor's additional spouse" test FAILS.

- [ ] **Step 3: Update `getCoreVisible`**

In `lib/treeCollapse.ts`, the current spouse step only seeds from root+descendants:

```ts
  const spouseTargets = new Set<string>([rootId, ...descendants]);
  for (const r of relationships) {
    if (r.type !== "spouse") continue;
    if (spouseTargets.has(r.person1Id)) core.add(r.person2Id);
    if (spouseTargets.has(r.person2Id)) core.add(r.person1Id);
  }
```

Replace with: add the spouse of ANY member currently in `core` (snapshot first so we add spouses only, not spouses-of-spouses):

```ts
  // Add the spouse of any visible person (root, ancestors, or descendants) so
  // additional spouses render wherever their partner is visible. Only the
  // spouse card is added — not the spouse's own ancestors.
  const coreSnapshot = new Set(core);
  for (const r of relationships) {
    if (r.type !== "spouse") continue;
    if (coreSnapshot.has(r.person1Id)) core.add(r.person2Id);
    if (coreSnapshot.has(r.person2Id)) core.add(r.person1Id);
  }
```

- [ ] **Step 4: Run tests**

Run: `npm test -- treeCollapse`
Expected: PASS (the new test passes; the deleted old test is gone; the rest still pass).

- [ ] **Step 5: Commit**

```bash
git add lib/treeCollapse.ts lib/treeCollapse.test.ts
git commit -m "feat: show additional spouses of any visible person (getCoreVisible)"
```

---

### Task 2: `MultiCoupleNode` component + registration

**Files:**
- Create: `components/tree/MultiCoupleNode.tsx`
- Modify: `components/tree/FamilyTree.tsx`

**Interfaces:**
- Produces: `MultiCoupleNodeType` = `Node<{ shared: IPerson; marriages: { spouse: IPerson; isDivorced?: boolean; divorceDate?: string }[]; width: number; onAddRelative?; onSelect?; siblingInfo?; onToggleSiblings? }, "multiCoupleNode">` and the `MultiCoupleNode` component. `width` is `160 + 220 * marriages.length`.
- Consumes: nothing new.

- [ ] **Step 1: Create `components/tree/MultiCoupleNode.tsx`**

Mirror the structure of `components/tree/PolyCoupleNode.tsx` (same imports, `PersonCard`, `MarriageLine`, gender maps — copy those helpers or import equivalents; PolyCoupleNode defines local `PersonCard`/`MarriageLine`, replicate them). Use this exact type + geometry:

```tsx
"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { IPerson, RelativeRole } from "@/types";

export type MultiCoupleNodeType = Node<
  {
    shared: IPerson;
    marriages: { spouse: IPerson; isDivorced?: boolean; divorceDate?: string }[];
    width: number;
    onAddRelative?: (personId: string, role: RelativeRole, personId2?: string) => void;
    onSelect?: (person: IPerson) => void;
    siblingInfo?: Record<string, { count: number; expanded: boolean }>;
    onToggleSiblings?: (personId: string) => void;
  },
  "multiCoupleNode"
>;

const genderBorder: Record<string, string> = {
  male: "border-blue-300", female: "border-pink-300", other: "border-purple-300", unknown: "border-gray-200",
};
const genderSelectedBorder: Record<string, string> = {
  male: "border-blue-500", female: "border-pink-500", other: "border-purple-500", unknown: "border-emerald-500",
};
const genderAvatar: Record<string, string> = {
  male: "bg-blue-50 text-blue-700", female: "bg-pink-50 text-pink-700", other: "bg-purple-50 text-purple-700", unknown: "bg-gray-50 text-gray-600",
};

function PersonCard({ person, selected, onClick }: { person: IPerson; selected: boolean; onClick: () => void }) {
  const initials = `${person.firstName[0] ?? "?"}${person.lastName[0] ?? ""}`;
  const gender = person.gender ?? "unknown";
  return (
    <div
      className={`bg-white border-2 rounded-xl shadow-sm w-40 shrink-0 cursor-pointer select-none transition-all ${
        selected ? `${genderSelectedBorder[gender]} shadow-md` : `${genderBorder[gender]} hover:shadow-md`
      }`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div className={`h-1 rounded-t-xl ${person.isLiving ? "bg-green-400" : "bg-gray-300"}`} />
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <Avatar className="h-11 w-11">
            <AvatarImage src={person.photoUrl} />
            <AvatarFallback className={`text-sm font-semibold ${genderAvatar[gender]}`}>{initials}</AvatarFallback>
          </Avatar>
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${person.isLiving ? "bg-green-400" : "bg-gray-400"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs leading-tight truncate">{person.firstName}</p>
          <p className="text-xs text-gray-600 leading-tight truncate">{person.lastName}</p>
          {(person.birthDate || person.deathDate) && (
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5 truncate">
              {person.birthDate ?? "?"}{!person.isLiving && person.deathDate ? `–${person.deathDate}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MarriageLine({ isDivorced, divorceDate }: { isDivorced?: boolean; divorceDate?: string }) {
  if (isDivorced) {
    return (
      <div className="flex flex-col items-center w-[60px] shrink-0 gap-0.5">
        <div className="flex items-center w-full">
          <div className="flex-1 h-[1.5px] bg-gray-400 [background-image:repeating-linear-gradient(to_right,#9ca3af_0,#9ca3af_4px,transparent_4px,transparent_8px)]" />
          <span className="text-red-400 text-xs mx-1 leading-none select-none font-bold">÷</span>
          <div className="flex-1 h-[1.5px] bg-gray-400 [background-image:repeating-linear-gradient(to_right,#9ca3af_0,#9ca3af_4px,transparent_4px,transparent_8px)]" />
        </div>
        {divorceDate && <span className="text-[9px] text-red-400 leading-none">{divorceDate}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center w-[60px] shrink-0">
      <div className="flex-1 h-[1.5px] bg-emerald-400" />
      <span className="text-emerald-500 text-sm mx-1 leading-none select-none">♥</span>
      <div className="flex-1 h-[1.5px] bg-emerald-400" />
    </div>
  );
}

export function MultiCoupleNode({ data, selected }: NodeProps<MultiCoupleNodeType>) {
  const { shared, marriages, onSelect } = data;
  return (
    <div className="relative">
      {/* target handles: shared parents + each spouse's parents */}
      <Handle type="target" position={Position.Top} id="shared" style={{ left: 80 }} className="!bg-gray-300 !w-2 !h-2" />
      {marriages.map((_, k) => (
        <Handle key={`t${k}`} type="target" position={Position.Top} id={`spouse${k}`} style={{ left: 300 + 220 * k }} className="!bg-gray-300 !w-2 !h-2" />
      ))}

      <div className="flex items-center">
        <PersonCard person={shared} selected={selected} onClick={() => onSelect?.(shared)} />
        {marriages.map((m, k) => (
          <div key={m.spouse._id} className="flex items-center">
            <MarriageLine isDivorced={m.isDivorced} divorceDate={m.divorceDate} />
            <PersonCard person={m.spouse} selected={selected} onClick={() => onSelect?.(m.spouse)} />
          </div>
        ))}
      </div>

      {/* source handle per marriage: children hang under that spouse */}
      {marriages.map((_, k) => (
        <Handle key={`s${k}`} type="source" position={Position.Bottom} id={`m${k}`} style={{ left: 300 + 220 * k }} className="!bg-gray-300 !w-2 !h-2" />
      ))}
    </div>
  );
}
```

> This mirrors PolyCoupleNode minus the add-relative buttons (kept out of scope for the multi node in this iteration — a person with 3+ spouses is edited via the person dialog). The chain reads left→right: shared person, then each spouse with a ♥/÷ marker; every marker denotes that spouse's marriage to the shared person.

- [ ] **Step 2: Register the node type in `FamilyTree.tsx`**

Add the import and register it in `nodeTypes` and the `AnyNode` union:

```ts
import { MultiCoupleNode, type MultiCoupleNodeType } from "./MultiCoupleNode";
```

Update the `nodeTypes` map:

```ts
const nodeTypes = {
  personNode: PersonNode,
  coupleNode: CoupleNode,
  polyCoupleNode: PolyCoupleNode,
  multiCoupleNode: MultiCoupleNode,
};
```

Update the `AnyNode` type alias in `FamilyTree.tsx`:

```ts
type AnyNode = PersonNodeType | CoupleNodeType | PolyCoupleNodeType | MultiCoupleNodeType;
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint` → no new errors.
Run: `npm run build` → clean. (If NextAuth "Unexpected token '<'"/api 404, wipe `.next` and rebuild.)

> `buildTreeData` does not yet emit `multiCoupleNode`, so nothing renders it yet — that's Task 3. This task only adds + registers the component (compiles clean, unused until wired).

- [ ] **Step 4: Commit**

```bash
git add components/tree/MultiCoupleNode.tsx components/tree/FamilyTree.tsx
git commit -m "feat: MultiCoupleNode component for 3+ spouses (shared + spouse chain)"
```

---

### Task 3: buildTreeData builds `multiCoupleNode` for 3+ spouses

**Files:**
- Modify: `lib/buildTreeData.ts`
- Test: `lib/buildTreeData.multispouse.test.ts` (create)

**Interfaces:**
- Consumes: `MultiCoupleNodeType` (Task 2).
- Produces: for a person with ≥3 distinct spouses, one node `{ id: \`multi_${sharedId}\`, type: "multiCoupleNode", data: { shared, marriages, width, ... } }`; child edges of that person + spouse `k` get `source = multi_${sharedId}`, `sourceHandle = m${k}`.

- [ ] **Step 1: Write the failing test**

Create `lib/buildTreeData.multispouse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTreeData } from "./buildTreeData";
import type { IPerson, IRelationship } from "@/types";

const p = (id: string, gender: IPerson["gender"] = "unknown"): IPerson =>
  ({ _id: id, treeId: "t", firstName: id, lastName: "X", gender, isLiving: true,
     createdAt: new Date(), updatedAt: new Date() } as IPerson);
const sp = (a: string, b: string): IRelationship =>
  ({ _id: `sp-${a}-${b}`, treeId: "t", type: "spouse", person1Id: a, person2Id: b });
const pc = (a: string, b: string): IRelationship =>
  ({ _id: `pc-${a}-${b}`, treeId: "t", type: "parent-child", person1Id: a, person2Id: b });

describe("buildTreeData multi-spouse (3+)", () => {
  it("builds one multiCoupleNode for a person with 3 spouses", () => {
    const persons = [p("h", "male"), p("w1", "female"), p("w2", "female"), p("w3", "female")];
    const rels = [sp("h", "w1"), sp("h", "w2"), sp("h", "w3")];
    const { nodes } = buildTreeData(persons, rels, { onSelect: () => {} }, new Set());
    const multi = nodes.filter((n) => n.type === "multiCoupleNode");
    expect(multi).toHaveLength(1);
    const d = multi[0].data as { shared: IPerson; marriages: { spouse: IPerson }[]; width: number };
    expect(d.shared._id).toBe("h");
    expect(d.marriages.map((m) => m.spouse._id).sort()).toEqual(["w1", "w2", "w3"]);
    expect(d.width).toBe(160 + 220 * 3);
    // no stray lone person nodes for the spouses
    expect(nodes.some((n) => n.id === "w2")).toBe(false);
  });

  it("routes a child of the 2nd marriage to that marriage's source handle", () => {
    const persons = [p("h", "male"), p("w1", "female"), p("w2", "female"), p("w3", "female"), p("kid")];
    const rels = [sp("h", "w1"), sp("h", "w2"), sp("h", "w3"), pc("h", "kid"), pc("w2", "kid")];
    const { edges } = buildTreeData(persons, rels, { onSelect: () => {} }, new Set());
    // the edge from h -> kid must originate at the multi node with the handle for the w2 marriage
    const e = edges.find((ed) => ed.source === "multi_h");
    expect(e).toBeTruthy();
    // w2 is marriage index 1 when spouses are ordered w1,w2,w3
    expect(e!.sourceHandle).toBe("m1");
  });

  it("leaves a 2-spouse person as a polyCoupleNode (unchanged)", () => {
    const persons = [p("h", "male"), p("w1", "female"), p("w2", "female")];
    const { nodes } = buildTreeData(persons, [sp("h", "w1"), sp("h", "w2")], { onSelect: () => {} }, new Set());
    expect(nodes.some((n) => n.type === "polyCoupleNode")).toBe(true);
    expect(nodes.some((n) => n.type === "multiCoupleNode")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- buildTreeData.multispouse`
Expected: FAIL (no multiCoupleNode emitted; spouses become lone nodes).

- [ ] **Step 3: Widen the routing map types + add the multi branch**

In `lib/buildTreeData.ts`:

Change the poly routing map value type from the fixed handles to a string handle, and the target-slot map to string (multi uses `shared`/`spouse${k}`):

```ts
  const polyByPair = new Map<string, { nodeId: string; handle: string }>();
  const polyTargetSlot = new Map<string, string>();
```

Import the multi node type at the top (alongside the other node type imports):

```ts
import type { MultiCoupleNodeType } from "@/components/tree/MultiCoupleNode";
```

Add a node array + collection near `const polyCoupleNodes ...`:

```ts
  const multiCoupleNodes: MultiCoupleNodeType[] = [];
```

**Before** the exactly-2 poly loop, add a ≥3 loop over the SAME `polyEntries` (males-first ordering already computed). It consumes persons with 3+ distinct spouses so the poly/couple loops then skip them:

```ts
  // Persons with 3+ distinct spouses → one multiCoupleNode (shared + spouse chain).
  for (const [sharedId, rels] of polyEntries) {
    if (personInAnyCouple.has(sharedId)) continue;
    if (rels.some((r) => processedRelIds.has(r._id))) continue;

    // Dedup by spouse id; keep the first rel per spouse. Order = relationship order.
    const seen = new Map<string, IRelationship>();
    for (const r of rels) {
      const spId = r.person1Id === sharedId ? r.person2Id : r.person1Id;
      if (!seen.has(spId)) seen.set(spId, r);
    }
    if (seen.size < 3) continue; // 1 → couple, 2 → poly (handled elsewhere)

    const shared = persons.find((pp) => pp._id === sharedId);
    if (!shared) continue;
    const entries = [...seen.entries()]
      .map(([spId, rel]) => ({ spouse: persons.find((pp) => pp._id === spId), rel }))
      .filter((e): e is { spouse: IPerson; rel: IRelationship } => !!e.spouse);
    if (entries.length < 3) continue;
    // Skip if any spouse is already committed elsewhere
    if (entries.some((e) => personInAnyCouple.has(e.spouse._id))) continue;

    rels.forEach((r) => processedRelIds.add(r._id));
    personInAnyCouple.add(sharedId);
    entries.forEach((e) => personInAnyCouple.add(e.spouse._id));

    const multiId = `multi_${sharedId}`;
    couplesByPerson.set(sharedId, [multiId]);
    polyTargetSlot.set(sharedId, "shared");
    entries.forEach((e, k) => {
      const handle = `m${k}`;
      polyByPair.set(`${e.spouse._id}|${sharedId}`, { nodeId: multiId, handle });
      polyByPair.set(`${sharedId}|${e.spouse._id}`, { nodeId: multiId, handle });
      couplesByPerson.set(e.spouse._id, [multiId]);
      polyTargetSlot.set(e.spouse._id, `spouse${k}`);
    });

    const dim = hasFilter && !highlighted.has(sharedId) && entries.every((e) => !highlighted.has(e.spouse._id));

    multiCoupleNodes.push({
      id: multiId,
      type: "multiCoupleNode",
      position: { x: 0, y: 0 },
      style: dim ? { opacity: 0.25, transition: "opacity 0.2s" } : { opacity: 1 },
      data: {
        shared,
        marriages: entries.map((e) => ({ spouse: e.spouse, isDivorced: !!e.rel.endDate, divorceDate: e.rel.endDate })),
        width: 160 + 220 * entries.length,
        onAddRelative: callbacks.onAddRelative,
        onSelect: callbacks.onSelect,
        siblingInfo: callbacks.siblingInfo,
        onToggleSiblings: callbacks.onToggleSiblings,
      },
    } as MultiCoupleNodeType);
  }
```

Include the multi nodes in the returned `nodes` array (find the final `const nodes: AnyNode[] = [...coupleNodes, ...polyCoupleNodes, ...personNodes];` and add `...multiCoupleNodes`):

```ts
  const nodes: AnyNode[] = [...coupleNodes, ...polyCoupleNodes, ...multiCoupleNodes, ...personNodes];
```

Also widen the local `AnyNode` type in `buildTreeData.ts` to include `MultiCoupleNodeType`.

Also patch the `sourceInfo` fallback so a child of the shared person with an unknown co-parent still attaches to a real handle on the multi node. The current fallback is:

```ts
    const first = couplesByPerson.get(parentId)?.[0] ?? parentId;
    if (first.startsWith("poly_")) return { nodeId: first, handle: "left" };
    return { nodeId: first };
```

Add a `multi_` case (multi nodes have no default source handle; use the first marriage's handle):

```ts
    const first = couplesByPerson.get(parentId)?.[0] ?? parentId;
    if (first.startsWith("poly_")) return { nodeId: first, handle: "left" };
    if (first.startsWith("multi_")) return { nodeId: first, handle: "m0" };
    return { nodeId: first };
```

> The exactly-2 poly loop's `if (seenSpouses.size !== 2) continue;` already skips 3+, and now those persons are in `personInAnyCouple`, so the poly + single-couple loops skip them. The main child path (co-parent known) resolves via `polyByPair`; the edge builder already sets `sourceHandle` from `sourceInfo` and `targetHandle` from `polyTargetSlot`. Beyond the widened types and the fallback above, no other edge-builder change is needed.

- [ ] **Step 4: Run tests**

Run: `npm test -- buildTreeData`
Expected: the 3 new multispouse tests PASS; existing `buildTreeData.ordering` + `buildTreeData.siblings` still PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/buildTreeData.ts lib/buildTreeData.multispouse.test.ts
git commit -m "feat: buildTreeData emits multiCoupleNode + per-marriage child routing for 3+ spouses"
```

---

### Task 4: treeLayout dynamic width for `multiCoupleNode`

**Files:**
- Modify: `lib/treeLayout.ts`
- Test: `lib/treeLayout.multiwidth.test.ts` (create)

**Interfaces:**
- Consumes: multi nodes carry `data.width` (Task 3).
- Produces: layout uses the multi node's real width for dagre sizing, subtree width, fan placement, and `enforceRowGaps`.

- [ ] **Step 1: Write the failing test**

Create `lib/treeLayout.multiwidth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyDagreLayout } from "./treeLayout";

// two multi nodes in the same row must not overlap given their real widths
const multi = (id: string, width: number, x: number) =>
  ({ id, type: "multiCoupleNode", position: { x, y: 0 }, data: { width } } as unknown as {
    id: string; type?: string; position: { x: number; y: number }; data: unknown;
  });

describe("treeLayout multiCoupleNode width", () => {
  it("uses data.width so wide multi nodes do not overlap in a row", () => {
    // Without edges, dagre lays them out; enforceRowGaps must separate using real widths.
    const nodes = [multi("A", 820, 0), multi("B", 820, 100)];
    const laid = applyDagreLayout(nodes as never, []);
    const a = laid.find((n) => n.id === "A")!;
    const b = laid.find((n) => n.id === "B")!;
    // if they share a row, B.left must clear A.right (A.width 820) + min gap
    if (Math.round(a.position.y) === Math.round(b.position.y)) {
      expect(b.position.x).toBeGreaterThanOrEqual(a.position.x + 820);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- treeLayout.multiwidth`
Expected: FAIL (multi node treated as default/poly width, nodes overlap).

- [ ] **Step 3: Make width read `data.width` for multi nodes**

In `lib/treeLayout.ts`, the current width helper keys on type only:

```ts
function widthOfType(type?: string): number {
  return type === "polyCoupleNode" ? POLY_COUPLE_W : type === "coupleNode" ? COUPLE_W : PERSON_W;
}
```

Add a node-aware width helper and use it everywhere a node width is needed. After `const nodeById = new Map(...)` add:

```ts
  const widthOfNode = (id: string): number => {
    const n = nodeById.get(id);
    if (n?.type === "multiCoupleNode") {
      const w = (n as { data?: { width?: number } }).data?.width;
      if (typeof w === "number" && w > 0) return w;
    }
    return widthOfType(n?.type);
  };
```

Replace the existing `const widthOf = (id: string) => widthOfType(nodeById.get(id)?.type);` with `const widthOf = widthOfNode;`.

Fix the dagre sizing loop to use the node width (it currently calls `widthOfType(n.type)` before `nodeById`/`widthOfNode` exist — compute inline there):

```ts
  nodes.forEach((n) => {
    const w = n.type === "multiCoupleNode"
      ? ((n as { data?: { width?: number } }).data?.width ?? POLY_COUPLE_W)
      : widthOfType(n.type);
    g.setNode(n.id, { width: w, height: NODE_H });
  });
```

(`widthOf` — now `widthOfNode` — already flows into `subtreeWidth`, `placeFan`, `enforceRowGaps`, and the final top-left conversion, so those pick up the real width automatically.)

- [ ] **Step 4: Run tests**

Run: `npm test -- treeLayout`
Expected: `treeLayout.multiwidth` PASSES; existing `treeLayout.rowgap` still PASSES.

- [ ] **Step 5: Commit**

```bash
git add lib/treeLayout.ts lib/treeLayout.multiwidth.test.ts
git commit -m "feat: treeLayout honors multiCoupleNode dynamic width"
```

---

### Task 5: `nodesContentSignature` covers `multiCoupleNode`

**Files:**
- Modify: `lib/treeNodesSignature.ts`
- Test: `lib/treeNodesSignature.test.ts`

**Interfaces:**
- Consumes: `MultiCoupleNodeType`.
- Produces: signature changes when any spouse in a multi node, or a marriage's divorce flag, changes.

- [ ] **Step 1: Write the failing test**

Append to `lib/treeNodesSignature.test.ts`:

```ts
import type { MultiCoupleNodeType } from "@/components/tree/MultiCoupleNode";

const multiNode = (spouses: IPerson[]): MultiCoupleNodeType =>
  ({ id: "multi_h", type: "multiCoupleNode", position: { x: 0, y: 0 },
     data: { shared: person({ _id: "h" }), marriages: spouses.map((s) => ({ spouse: s })), width: 160 + 220 * spouses.length, onSelect: () => {} } } as MultiCoupleNodeType);

describe("nodesContentSignature multiCoupleNode", () => {
  it("changes when a spouse's name changes", () => {
    const a = nodesContentSignature([multiNode([person({ _id: "w1", firstName: "Ann" })])] );
    const b = nodesContentSignature([multiNode([person({ _id: "w1", firstName: "Anna" })])]);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- treeNodesSignature`
Expected: FAIL (multi branch not handled → both signatures equal / or type error on access).

- [ ] **Step 3: Handle the multi node in the signature**

In `lib/treeNodesSignature.ts`, update the `AnyNode` type to include `MultiCoupleNodeType` (add the import) and add a branch in `nodesContentSignature` before the personNode fallback:

```ts
      if (n.type === "multiCoupleNode") {
        const d = n.data;
        return [
          n.id,
          personSig(d.shared, d.siblingInfo),
          ...d.marriages.map(
            (m, k) => `${personSig(m.spouse, d.siblingInfo)}:div${k}:${m.isDivorced ?? false}:${m.divorceDate ?? ""}`
          ),
        ].join("|");
      }
```

Add the import at top:

```ts
import type { MultiCoupleNodeType } from "@/components/tree/MultiCoupleNode";
```

and widen: `type AnyNode = PersonNodeType | CoupleNodeType | PolyCoupleNodeType | MultiCoupleNodeType;`

- [ ] **Step 4: Run tests**

Run: `npm test -- treeNodesSignature`
Expected: PASS (all, incl. new multi test).

- [ ] **Step 5: Commit**

```bash
git add lib/treeNodesSignature.ts lib/treeNodesSignature.test.ts
git commit -m "feat: content signature covers multiCoupleNode spouses"
```

---

### Task 6: End-to-end verification

**Files:** none.

- [ ] **Step 1: Full gate**

Run: `npm run lint && npm test && npm run build`
Expected: all pass; only the pre-existing unrelated `DashboardClient.tsx` lint error remains.

- [ ] **Step 2: Start dev + inspect the real case**

Run: `npm run dev` (background). Open `http://localhost:3000`, log in, open the tree with Vladimer Makharashvili.

> If `/api/auth` 404s or NextAuth throws "Unexpected token '<'", stop, wipe `.next`, `npm run dev` again.

- [ ] **Step 3: Verify multi-spouse rendering**

Vladimer shows as a multi node: his card first, then all his spouses (named + "?" placeholders) in a row, each with a ♥ (or ÷ if divorced) marker. Children of each marriage hang under the correct spouse. No overlap with neighbor nodes.

- [ ] **Step 4: Verify no regressions**

A person with exactly 1 spouse still renders as a plain couple; a person with exactly 2 still renders as the centered poly node — both visually identical to before. An ancestor's additional spouse now appears.

- [ ] **Step 5: Verify live update**

Add a spouse to a person who already has 2 (making 3) → they re-render as a multi node without a manual refresh (edge + content signatures cover it).

Report verification results with actual output before declaring complete.
