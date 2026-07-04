# Live-Updating UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make add/edit/delete reflect immediately — fix the tree canvas so field edits render without a refresh (root cause of the "Lina death date" bug), and add SWR polling + focus revalidation so other users'/tabs' changes appear automatically.

**Architecture:** A pure `nodesContentSignature(nodes)` helper feeds the display-relevant field content into FamilyTree's layout `useMemo` deps, so a content-only edit re-renders the cards with identical dagre positions; the viewport re-fit is split off to run only on node-set changes. A global `SWRConfig` adds 20s polling + focus/reconnect revalidation to every `useSWR` hook.

**Tech Stack:** Next.js 16, React 19, TypeScript, `@xyflow/react` + dagre, SWR, vitest.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/components/...`.
- Do NOT change dagre/pedigree-fan math in `lib/treeLayout.ts` or the couple/poly node visuals — positions must stay identical on a content edit.
- Every mutation site already calls SWR `mutate()`; do NOT rewrite mutation handlers.
- No React-component tests in this repo (convention) — the pure helper is unit-tested with vitest; FamilyTree/providers are verified via lint + build + manual.
- Run `npm test` after touching tested lib code (repo has vitest).
- SWR polling config values (verbatim): `refreshInterval: 20000`, `revalidateOnFocus: true`, `revalidateOnReconnect: true`, `dedupingInterval: 5000`.

---

### Task 1: `nodesContentSignature` helper

**Files:**
- Create: `lib/treeNodesSignature.ts`
- Test: `lib/treeNodesSignature.test.ts`

**Interfaces:**
- Consumes: node types `PersonNodeType`, `CoupleNodeType`, `PolyCoupleNodeType` from the tree components; `IPerson`.
- Produces: `nodesContentSignature(nodes: Array<PersonNodeType | CoupleNodeType | PolyCoupleNodeType>): string` — a deterministic string that changes iff a display-relevant field (name, birth/death date, isLiving, photo, divorce flags, per-person collapse flag, or per-person sibling control count/expanded) changes. Independent of node position and of callback identities.

- [ ] **Step 1: Write the failing test**

Create `lib/treeNodesSignature.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nodesContentSignature } from "./treeNodesSignature";
import type { IPerson } from "@/types";
import type { PersonNodeType } from "@/components/tree/PersonNode";

const person = (over: Partial<IPerson> = {}): IPerson =>
  ({ _id: "p1", treeId: "t", firstName: "Lina", lastName: "K", gender: "female",
     isLiving: false, deathDate: "2020", createdAt: new Date(), updatedAt: new Date(), ...over } as IPerson);

const personNode = (p: IPerson): PersonNodeType =>
  ({ id: p._id, type: "personNode", position: { x: 0, y: 0 },
     data: { person: p, onSelect: () => {} } } as PersonNodeType);

describe("nodesContentSignature", () => {
  it("changes when a person's deathDate changes", () => {
    const a = nodesContentSignature([personNode(person({ deathDate: "2020" }))]);
    const b = nodesContentSignature([personNode(person({ deathDate: "2021" }))]);
    expect(a).not.toBe(b);
  });

  it("is stable when only the position / callbacks change", () => {
    const p = person();
    const n1 = personNode(p);
    const n2: PersonNodeType = { ...n1, position: { x: 999, y: 999 }, data: { person: p, onSelect: () => {} } };
    expect(nodesContentSignature([n1])).toBe(nodesContentSignature([n2]));
  });

  it("changes when isLiving flips", () => {
    const a = nodesContentSignature([personNode(person({ isLiving: true }))]);
    const b = nodesContentSignature([personNode(person({ isLiving: false }))]);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- treeNodesSignature`
Expected: FAIL — `nodesContentSignature is not a function`.

- [ ] **Step 3: Implement the helper**

Create `lib/treeNodesSignature.ts`:

```ts
import type { IPerson } from "@/types";
import type { PersonNodeType } from "@/components/tree/PersonNode";
import type { CoupleNodeType } from "@/components/tree/CoupleNode";
import type { PolyCoupleNodeType } from "@/components/tree/PolyCoupleNode";

type AnyNode = PersonNodeType | CoupleNodeType | PolyCoupleNodeType;
type SiblingInfo = Record<string, { count: number; expanded: boolean }> | undefined;

function personSig(p: IPerson, siblingInfo: SiblingInfo): string {
  const s = siblingInfo?.[p._id];
  const sib = s ? `${s.count}/${s.expanded}` : "";
  return `${p._id}:${p.firstName}:${p.lastName}:${p.birthDate ?? ""}:${p.deathDate ?? ""}:${p.isLiving}:${p.photoUrl ?? ""}:${sib}`;
}

/**
 * Deterministic signature of the display-relevant content of the tree nodes.
 * Changes iff a field shown on a card (name, dates, living state, photo),
 * a divorce marker, a per-person collapse flag, or a per-person sibling
 * control (count/expanded) changes. Ignores positions and callback identity,
 * so it is safe to use as a React memo dependency that fires on content edits
 * but not on re-renders that only produce new callback closures.
 */
export function nodesContentSignature(nodes: AnyNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "coupleNode") {
        const d = n.data;
        return [
          n.id,
          personSig(d.person1, d.siblingInfo),
          personSig(d.person2, d.siblingInfo),
          `div:${d.isDivorced ?? false}:${d.divorceDate ?? ""}`,
          `c:${d.isCollapsed1 ?? false}:${d.isCollapsed2 ?? false}`,
        ].join("|");
      }
      if (n.type === "polyCoupleNode") {
        const d = n.data;
        return [
          n.id,
          personSig(d.leftSpouse, d.siblingInfo),
          personSig(d.shared, d.siblingInfo),
          personSig(d.rightSpouse, d.siblingInfo),
          `div:${d.isDivorced1 ?? false}:${d.divorceDate1 ?? ""}:${d.isDivorced2 ?? false}:${d.divorceDate2 ?? ""}`,
        ].join("|");
      }
      const d = n.data;
      return [n.id, personSig(d.person, d.siblingInfo), `c:${d.isCollapsed ?? false}`].join("|");
    })
    .join(";");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- treeNodesSignature`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/treeNodesSignature.ts lib/treeNodesSignature.test.ts
git commit -m "feat: nodesContentSignature helper for tree content-change detection"
```

---

### Task 2: FamilyTree re-renders on content edits

**Files:**
- Modify: `components/tree/FamilyTree.tsx`

**Interfaces:**
- Consumes: `nodesContentSignature` (Task 1).
- Produces: nothing downstream.

- [ ] **Step 1: Import the helper**

In `components/tree/FamilyTree.tsx`, add near the other `@/lib` imports:

```ts
import { nodesContentSignature } from "@/lib/treeNodesSignature";
```

- [ ] **Step 2: Add the content signature to the layout memo deps**

The current block is:

```tsx
  const nodeIds = rawNodes.map((n) => n.id).join(",");
  const edgeIds = rawEdges.map((e) => e.id).join(",");

  const layoutNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges),
    // Re-layout only when node/edge IDs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeIds, edgeIds]
  );
```

Replace it with:

```tsx
  const nodeIds = rawNodes.map((n) => n.id).join(",");
  const edgeIds = rawEdges.map((e) => e.id).join(",");
  const contentSig = nodesContentSignature(rawNodes);

  const layoutNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges),
    // Re-layout when the node/edge SET changes, or when card content changes
    // (content edits keep identical dagre positions since layout is structural).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeIds, edgeIds, contentSig]
  );
```

- [ ] **Step 3: Split the layout-sync effect from the fit-view effect**

The current effect is:

```tsx
  // Sync layout; re-fit viewport when node set changes (e.g. second spouse added)
  useEffect(() => {
    setNodes(layoutNodes);
    if (!isFirstLayout.current) {
      const t = setTimeout(() => rfInstance.current?.fitView({ padding: 0.25, duration: 300 }), 50);
      return () => clearTimeout(t);
    }
    isFirstLayout.current = false;
  }, [layoutNodes, setNodes]);
```

Replace it with two effects:

```tsx
  // Push fresh layout/data into the canvas on any change (structure OR content edit).
  useEffect(() => {
    setNodes(layoutNodes);
  }, [layoutNodes, setNodes]);

  // Re-fit the viewport only when the node SET changes (add/remove/expand),
  // NOT on content edits — editing a field must not move or re-center the view.
  useEffect(() => {
    if (isFirstLayout.current) {
      isFirstLayout.current = false;
      return;
    }
    const t = setTimeout(() => rfInstance.current?.fitView({ padding: 0.25, duration: 300 }), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIds]);
```

- [ ] **Step 4: Lint + build + existing tests**

Run: `npm run lint`
Expected: no new errors (a pre-existing unrelated `DashboardClient.tsx` error may remain).

Run: `npm test`
Expected: all tests PASS (incl. Task 1's new test).

Run: `npm run build`
Expected: compiles clean. (If it fails with NextAuth "Unexpected token '<'" / `/api/auth` 404, delete the whole `.next` directory and rebuild.)

- [ ] **Step 5: Commit**

```bash
git add components/tree/FamilyTree.tsx
git commit -m "fix: family tree canvas re-renders on person field edits (not only add/delete)"
```

---

### Task 3: Global SWR polling + focus/reconnect revalidation

**Files:**
- Modify: `components/providers.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: global SWR defaults inherited by every `useSWR` hook.

- [ ] **Step 1: Wrap children in `SWRConfig`**

Replace the entire contents of `components/providers.tsx` with:

```tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig
        value={{
          refreshInterval: 20000,
          revalidateOnFocus: true,
          revalidateOnReconnect: true,
          dedupingInterval: 5000,
        }}
      >
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: compiles clean.

- [ ] **Step 3: Commit**

```bash
git add components/providers.tsx
git commit -m "feat: global SWR polling + focus/reconnect revalidation for live cross-tab updates"
```

---

### Task 4: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background). Open `http://localhost:3000`, log in, open a tree.

> If `/api/auth` 404s or NextAuth throws "Unexpected token '<'", stop the server, wipe the whole `.next` directory, and `npm run dev` again.

- [ ] **Step 2: Verify own field edit reflects instantly (the Lina bug)**

Open a person, mark deceased (if needed), set/change the death year, Save. The card on the canvas updates **immediately** with the new value — no manual refresh. Confirm the node does NOT move and the viewport does NOT re-center/zoom.

- [ ] **Step 3: Verify no regression on structure changes**

Add a person → appears; delete a person → disappears; expand an ancestor's siblings → they reveal. Each still re-fits the viewport as before.

- [ ] **Step 4: Verify cross-tab freshness**

Open the same tree in two browser tabs. Edit a person's name in tab A and Save. In tab B: the change appears within ~20s, or immediately when you click back into (focus) tab B.

- [ ] **Step 5: Final quality gate**

Run: `npm run lint && npm test && npm run build`
Expected: all pass.

Report verification results (with actual output) before declaring complete.
