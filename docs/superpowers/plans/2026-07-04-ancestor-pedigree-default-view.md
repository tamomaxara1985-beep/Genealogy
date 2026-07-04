# Ancestor-Pedigree Default View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the family tree focused on the root person's direct-ancestor pedigree (plus the root's own spouse and descendants), with every collateral branch — the root's siblings and the siblings of every ancestor generation — collapsed by default and expandable on demand.

**Architecture:** Compute a "core visible" set (root + ancestors + descendants + relevant spouses) from the relationship graph; hide everyone else. A per-person `expandedSiblingIds` set (localStorage-persisted) reveals a given ancestor's siblings on demand. The existing root-only sibling toggle is generalised to every spine person via a new `siblingInfo` map threaded through `buildTreeData` into the node components, which render a small +/− circle control on each card edge.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, `@xyflow/react` + dagre, Tailwind v4, vitest.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/components/...`, `@/types`.
- Node components use hardcoded English tooltip strings (e.g. `"Show ancestors"`). Do **not** add i18n to node tooltips — match the existing pattern.
- Emerald accent: `emerald-400` hover border / `emerald-700` hover text, matching existing controls.
- Every couple is stored female-left / male-right (`buildTreeData` handles this) — do not change ordering.
- Run `npm test` after touching tested lib code (repo has vitest despite CLAUDE.md).
- Do NOT change dagre / pedigree-fan layout math in `lib/treeLayout.ts`.

---

### Task 1: `getCoreVisible` helper

**Files:**
- Modify: `lib/treeCollapse.ts`
- Test: `lib/treeCollapse.test.ts` (create)

**Interfaces:**
- Consumes: existing `getAncestors`, `getDescendants` from the same file.
- Produces: `getCoreVisible(rootId: string, relationships: IRelationship[]): Set<string>` — the set of person IDs visible by default: the root, all its ancestors, all its descendants, and the spouses of the root and of each descendant (co-parents). Spouses of *ancestors* are intentionally excluded.

- [ ] **Step 1: Write the failing test**

Create `lib/treeCollapse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getCoreVisible } from "./treeCollapse";
import type { IRelationship } from "@/types";

const pc = (parent: string, child: string): IRelationship =>
  ({ _id: `pc-${parent}-${child}`, treeId: "t", type: "parent-child", person1Id: parent, person2Id: child });
const sp = (a: string, b: string): IRelationship =>
  ({ _id: `sp-${a}-${b}`, treeId: "t", type: "spouse", person1Id: a, person2Id: b });

describe("getCoreVisible", () => {
  it("root alone yields just the root", () => {
    expect([...getCoreVisible("root", [])]).toEqual(["root"]);
  });

  it("includes both parents and grandparents (full pedigree)", () => {
    const rels = [pc("dad", "root"), pc("mom", "root"), pc("gpa", "dad"), pc("gma", "dad")];
    const core = getCoreVisible("root", rels);
    ["root", "dad", "mom", "gpa", "gma"].forEach((id) => expect(core.has(id)).toBe(true));
  });

  it("includes descendants and their spouses", () => {
    const rels = [pc("root", "kid"), sp("kid", "kidspouse")];
    const core = getCoreVisible("root", rels);
    expect(core.has("kid")).toBe(true);
    expect(core.has("kidspouse")).toBe(true);
  });

  it("includes the root's own spouse", () => {
    const core = getCoreVisible("root", [sp("root", "wife")]);
    expect(core.has("wife")).toBe(true);
  });

  it("excludes the root's siblings", () => {
    const rels = [pc("dad", "root"), pc("dad", "sib")];
    expect(getCoreVisible("root", rels).has("sib")).toBe(false);
  });

  it("excludes an ancestor's non-ancestor extra spouse", () => {
    // dad is an ancestor; dad's second wife 'stepmom' is not root's ancestor
    const rels = [pc("dad", "root"), sp("dad", "stepmom")];
    expect(getCoreVisible("root", rels).has("stepmom")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- treeCollapse`
Expected: FAIL — `getCoreVisible is not a function` / not exported.

- [ ] **Step 3: Implement `getCoreVisible`**

Append to `lib/treeCollapse.ts` (after `getSiblings`):

```ts
/**
 * Person IDs visible by default in the pedigree view:
 *  - the root
 *  - all of the root's ancestors (both parents each generation → full pedigree)
 *  - all of the root's descendants
 *  - the spouses of the root and of each descendant (co-parents, so couples render)
 *
 * Spouses of ancestors are NOT added: both parents of each generation are
 * already ancestors, so ancestor couples form on their own. This keeps an
 * ancestor's unrelated additional marriage out of the default view.
 */
export function getCoreVisible(
  rootId: string,
  relationships: IRelationship[]
): Set<string> {
  const core = new Set<string>([rootId]);
  getAncestors(rootId, relationships).forEach((id) => core.add(id));

  const descendants = getDescendants(rootId, relationships);
  descendants.forEach((id) => core.add(id));

  const spouseTargets = new Set<string>([rootId, ...descendants]);
  for (const r of relationships) {
    if (r.type !== "spouse") continue;
    if (spouseTargets.has(r.person1Id)) core.add(r.person2Id);
    if (spouseTargets.has(r.person2Id)) core.add(r.person1Id);
  }
  return core;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- treeCollapse`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/treeCollapse.ts lib/treeCollapse.test.ts
git commit -m "feat: getCoreVisible helper for pedigree default view"
```

---

### Task 2: Generalise sibling plumbing (buildTreeData + node components)

Replaces the root-only sibling fields (`rootPersonId`, `rootSiblingCount`, `rootSiblingsExpanded`, `onToggleRootSiblings`, `rootSlot`) with a per-person `siblingInfo` map and a single `onToggleSiblings(personId)` callback, and swaps the root-only toggle UI for a generalised +/− circle on every card that has hidden siblings. All of these files are TypeScript-compile-linked, so they change together.

**Files:**
- Modify: `lib/buildTreeData.ts`
- Modify: `components/tree/PersonNode.tsx`
- Modify: `components/tree/CoupleNode.tsx`
- Modify: `components/tree/PolyCoupleNode.tsx`
- Test: `lib/buildTreeData.siblings.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - Shared node-data shape (added to `PersonNodeType`, `CoupleNodeType`, `PolyCoupleNodeType` data):
    ```ts
    siblingInfo?: Record<string, { count: number; expanded: boolean }>;
    onToggleSiblings?: (personId: string) => void;
    ```
  - `buildTreeData` `Callbacks` interface gains `siblingInfo?` and `onToggleSiblings?`, and drops `rootPersonId`, `rootSiblingCount`, `rootSiblingsExpanded`, `onToggleRootSiblings`.

- [ ] **Step 1: Write the failing test**

Create `lib/buildTreeData.siblings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTreeData } from "./buildTreeData";
import type { IPerson } from "@/types";

const p = (id: string, gender: IPerson["gender"]): IPerson =>
  ({ _id: id, treeId: "t", firstName: id, lastName: "X", gender, isLiving: true,
     createdAt: new Date(), updatedAt: new Date() } as IPerson);

describe("buildTreeData sibling plumbing", () => {
  it("passes siblingInfo and onToggleSiblings to a person node", () => {
    const toggle = () => {};
    const info = { a: { count: 2, expanded: false } };
    const { nodes } = buildTreeData(
      [p("a", "male")],
      [],
      { onSelect: () => {}, siblingInfo: info, onToggleSiblings: toggle },
      new Set()
    );
    const node = nodes.find((n) => n.id === "a");
    expect((node!.data as { siblingInfo?: unknown }).siblingInfo).toBe(info);
    expect((node!.data as { onToggleSiblings?: unknown }).onToggleSiblings).toBe(toggle);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- buildTreeData.siblings`
Expected: FAIL — `siblingInfo` is `undefined` on the node data (field not yet wired).

- [ ] **Step 3: Update `buildTreeData.ts`**

In `lib/buildTreeData.ts`, replace the `Callbacks` interface (lines 8-17) with:

```ts
interface Callbacks {
  onAddRelative?: (personId: string, role: RelativeRole, personId2?: string) => void;
  onSelect: (person: IPerson) => void;
  onToggleCollapse?: (personId: string) => void;
  collapsedPersonIds?: Set<string>;
  siblingInfo?: Record<string, { count: number; expanded: boolean }>;
  onToggleSiblings?: (personId: string) => void;
}
```

Delete the `hasRootBadge` / `isRootPerson` helpers (lines 27-29):

```ts
  const hasRootBadge = (callbacks.rootSiblingCount ?? 0) > 0;
  const isRootPerson = (id: string) =>
    hasRootBadge && callbacks.rootPersonId === id;
```

In the **polyCoupleNode** `data` object (lines 132-146), remove the `rootSlot`, `rootSiblingCount`, `rootSiblingsExpanded`, `onToggleRootSiblings` fields and add:

```ts
        siblingInfo: callbacks.siblingInfo,
        onToggleSiblings: callbacks.onToggleSiblings,
```

In the **coupleNode** `data` object (lines 195-201), remove `rootSlot`, `rootSiblingCount`, `rootSiblingsExpanded`, `onToggleRootSiblings` and add:

```ts
          siblingInfo: callbacks.siblingInfo,
          onToggleSiblings: callbacks.onToggleSiblings,
```

In the **personNode** `data` object (lines 222-225), remove `isRoot`, `rootSiblingCount`, `rootSiblingsExpanded`, `onToggleRootSiblings` and add:

```ts
          siblingInfo: callbacks.siblingInfo,
          onToggleSiblings: callbacks.onToggleSiblings,
```

- [ ] **Step 4: Update `PersonNode.tsx`**

In `components/tree/PersonNode.tsx`:

Change the icon import (line 4) to add `Plus`/`Minus`:

```ts
import { ChevronUp, ChevronDown, Plus, Minus } from "lucide-react";
```

Replace the type fields `isRoot`, `rootSiblingCount`, `rootSiblingsExpanded`, `onToggleRootSiblings` (lines 13-17) with:

```ts
    siblingInfo?: Record<string, { count: number; expanded: boolean }>;
    onToggleSiblings?: (personId: string) => void;
```

Update the destructure (line 64):

```ts
  const { person, onAddRelative, onSelect, onToggleCollapse, isCollapsed, siblingInfo, onToggleSiblings } = data;
  const sibInfo = siblingInfo?.[person._id];
```

Replace the entire "Root siblings toggle" block (lines 106-118) with the generalised control:

```tsx
      {/* Sibling reveal control — left edge of the card */}
      {onToggleSiblings && sibInfo && sibInfo.count > 0 && (
        <button
          className="nodrag nopan absolute top-1/2 -translate-y-1/2 -left-7 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm text-[11px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          onClick={(e) => { e.stopPropagation(); onToggleSiblings(person._id); }}
          title={sibInfo.expanded ? "Hide siblings" : `Show ${sibInfo.count} sibling${sibInfo.count === 1 ? "" : "s"}`}
        >
          {sibInfo.expanded ? <Minus size={12} /> : sibInfo.count}
        </button>
      )}
```

- [ ] **Step 5: Update `CoupleNode.tsx`**

In `components/tree/CoupleNode.tsx`:

Change the icon import (line 4):

```ts
import { ChevronUp, ChevronDown, Plus, Minus } from "lucide-react";
```

Replace the type fields `rootSlot`, `rootSiblingCount`, `rootSiblingsExpanded`, `onToggleRootSiblings` (lines 18-21) with:

```ts
    siblingInfo?: Record<string, { count: number; expanded: boolean }>;
    onToggleSiblings?: (personId: string) => void;
```

Update the destructure (line 128):

```ts
  const { person1, person2, onAddRelative, onSelect, isDivorced, divorceDate, onToggleCollapse, isCollapsed1, isCollapsed2, siblingInfo, onToggleSiblings } = data;
  const sib1 = siblingInfo?.[person1._id];
  const sib2 = siblingInfo?.[person2._id];
```

Replace the entire "Root siblings toggle" block (lines 228-241) with per-person controls (person1 card center 80, person2 card center 300):

```tsx
      {/* Sibling reveal controls — left edge of each card */}
      {onToggleSiblings && sib1 && sib1.count > 0 && (
        <button
          className="nodrag nopan absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm text-[11px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          style={{ left: -28 }}
          onClick={(e) => { e.stopPropagation(); onToggleSiblings(person1._id); }}
          title={sib1.expanded ? "Hide siblings" : `Show ${sib1.count} sibling${sib1.count === 1 ? "" : "s"}`}
        >
          {sib1.expanded ? <Minus size={12} /> : sib1.count}
        </button>
      )}
      {onToggleSiblings && sib2 && sib2.count > 0 && (
        <button
          className="nodrag nopan absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm text-[11px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          style={{ left: 192 }}
          onClick={(e) => { e.stopPropagation(); onToggleSiblings(person2._id); }}
          title={sib2.expanded ? "Hide siblings" : `Show ${sib2.count} sibling${sib2.count === 1 ? "" : "s"}`}
        >
          {sib2.expanded ? <Minus size={12} /> : sib2.count}
        </button>
      )}
```

- [ ] **Step 6: Update `PolyCoupleNode.tsx`**

In `components/tree/PolyCoupleNode.tsx`:

Change the icon import (line 4) — `ChevronUp`/`ChevronDown` were only used by the removed root toggle, so replace them:

```ts
import { Plus, Minus } from "lucide-react";
```

Replace the type fields `rootSlot`, `rootSiblingCount`, `rootSiblingsExpanded`, `onToggleRootSiblings` (lines 22-25) with:

```ts
    siblingInfo?: Record<string, { count: number; expanded: boolean }>;
    onToggleSiblings?: (personId: string) => void;
```

Update the destructure (line 113):

```ts
  const { leftSpouse, shared, rightSpouse, isDivorced1, divorceDate1, isDivorced2, divorceDate2, onAddRelative, onSelect, siblingInfo, onToggleSiblings } = data;
  const sibL = siblingInfo?.[leftSpouse._id];
  const sibS = siblingInfo?.[shared._id];
  const sibR = siblingInfo?.[rightSpouse._id];
```

Replace the entire "Root siblings toggle" block (lines 178-191) with three controls (left card center 80, shared 300, right 520):

```tsx
      {/* Sibling reveal controls — left edge of each card */}
      {onToggleSiblings && sibL && sibL.count > 0 && (
        <button
          className="nodrag nopan absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm text-[11px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          style={{ left: -28 }}
          onClick={(e) => { e.stopPropagation(); onToggleSiblings(leftSpouse._id); }}
          title={sibL.expanded ? "Hide siblings" : `Show ${sibL.count} sibling${sibL.count === 1 ? "" : "s"}`}
        >
          {sibL.expanded ? <Minus size={12} /> : sibL.count}
        </button>
      )}
      {onToggleSiblings && sibS && sibS.count > 0 && (
        <button
          className="nodrag nopan absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm text-[11px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          style={{ left: 192 }}
          onClick={(e) => { e.stopPropagation(); onToggleSiblings(shared._id); }}
          title={sibS.expanded ? "Hide siblings" : `Show ${sibS.count} sibling${sibS.count === 1 ? "" : "s"}`}
        >
          {sibS.expanded ? <Minus size={12} /> : sibS.count}
        </button>
      )}
      {onToggleSiblings && sibR && sibR.count > 0 && (
        <button
          className="nodrag nopan absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm text-[11px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          style={{ left: 412 }}
          onClick={(e) => { e.stopPropagation(); onToggleSiblings(rightSpouse._id); }}
          title={sibR.expanded ? "Hide siblings" : `Show ${sibR.count} sibling${sibR.count === 1 ? "" : "s"}`}
        >
          {sibR.expanded ? <Minus size={12} /> : sibR.count}
        </button>
      )}
```

- [ ] **Step 7: Run the sibling test + existing ordering test + lint**

Run: `npm test -- buildTreeData`
Expected: PASS — both `buildTreeData.siblings` (1 test) and `buildTreeData.ordering` (3 tests).

Run: `npm run lint`
Expected: no errors (no unused `ChevronUp`/`ChevronDown` in PolyCoupleNode, no dangling root-sibling references).

> NOTE: `app/(dashboard)/trees/[treeId]/page.tsx` still passes the old `rootPersonId`/`rootSibling*` callback fields and will fail typecheck until Task 3. `npm run build` is therefore deferred to Task 3. `npm test` and `npm run lint` (which lints per-file) validate this task.

- [ ] **Step 8: Commit**

```bash
git add lib/buildTreeData.ts lib/buildTreeData.siblings.test.ts components/tree/PersonNode.tsx components/tree/CoupleNode.tsx components/tree/PolyCoupleNode.tsx
git commit -m "feat: generalise root-sibling toggle to per-person sibling control"
```

---

### Task 3: Wire pedigree default view into the tree page

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

**Interfaces:**
- Consumes: `getCoreVisible` (Task 1); `siblingInfo` / `onToggleSiblings` callback fields on `buildTreeData` (Task 2); existing `getAncestors`, `getSiblings`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Update imports**

In `app/(dashboard)/trees/[treeId]/page.tsx`, change the treeCollapse import (line 27) — drop `getDescendants` (no longer used here), add `getCoreVisible`:

```ts
import { getAncestors, getSiblings, getCoreVisible } from "@/lib/treeCollapse";
```

- [ ] **Step 2: Replace root-siblings state with `expandedSiblingIds`**

Replace line 187:

```ts
  const [rootSiblingsExpanded, setRootSiblingsExpanded] = useState(false);
```

with:

```ts
  const [expandedSiblingIds, setExpandedSiblingIds] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Swap the localStorage effects**

Replace the two `rootSiblingsExpanded` effects (lines 211-224) with:

```ts
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`tree-expanded-siblings-${treeId}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setExpandedSiblingIds(new Set<string>(JSON.parse(stored)));
    } catch {}
  }, [treeId]);

  useEffect(() => {
    localStorage.setItem(
      `tree-expanded-siblings-${treeId}`,
      JSON.stringify([...expandedSiblingIds])
    );
  }, [expandedSiblingIds, treeId]);
```

- [ ] **Step 4: Replace root-sibling derived values with spine + siblingInfo + toggle**

Replace the `rootSiblingIds` memo and `toggleRootSiblings` callback (lines 281-288) with:

```ts
  const spineIds = useMemo(() => {
    const s = new Set<string>();
    if (!rootId) return s;
    s.add(rootId);
    getAncestors(rootId, relationships).forEach((id) => s.add(id));
    return s;
  }, [rootId, relationships]);

  const siblingInfo = useMemo(() => {
    const info: Record<string, { count: number; expanded: boolean }> = {};
    spineIds.forEach((id) => {
      const count = getSiblings(id, relationships).size;
      if (count > 0) info[id] = { count, expanded: expandedSiblingIds.has(id) };
    });
    return info;
  }, [spineIds, relationships, expandedSiblingIds]);

  const toggleSiblings = useCallback((personId: string) => {
    setExpandedSiblingIds((prev) => {
      const next = new Set(prev);
      next.has(personId) ? next.delete(personId) : next.add(personId);
      return next;
    });
  }, []);
```

> `rootId` is defined at line 279 (`const rootId = useMemo(() => getRootPersonId(persons), [persons])`) — keep it; these memos depend on it, so they must come after it (they already do).

- [ ] **Step 5: Update `expandAll` to also reveal all sibling branches**

Replace the `expandAll` callback (lines 275-277):

```ts
  const expandAll = useCallback(() => {
    setCollapsedPersonIds(new Set());
    const all = new Set<string>();
    spineIds.forEach((id) => {
      if (getSiblings(id, relationships).size > 0) all.add(id);
    });
    setExpandedSiblingIds(all);
  }, [spineIds, relationships]);
```

> `expandAll` currently sits at line 275, *before* `spineIds` is declared (Step 4 adds `spineIds` at ~line 281). Move the `expandAll` definition to just after the `toggleSiblings` callback from Step 4 so `spineIds` is in scope.

- [ ] **Step 6: Rewrite `hiddenIds`**

Replace the `hiddenIds` memo (lines 318-330) with:

```ts
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    if (rootId) {
      const core = getCoreVisible(rootId, relationships);
      const revealed = new Set<string>();
      expandedSiblingIds.forEach((id) => {
        getSiblings(id, relationships).forEach((sib) => revealed.add(sib));
      });
      // include spouses of revealed siblings so they pair into couple nodes
      for (const r of relationships) {
        if (r.type !== "spouse") continue;
        if (revealed.has(r.person1Id)) revealed.add(r.person2Id);
        if (revealed.has(r.person2Id)) revealed.add(r.person1Id);
      }
      persons.forEach((p) => {
        if (!core.has(p._id) && !revealed.has(p._id)) hidden.add(p._id);
      });
    }
    // existing manual "hide ancestors" collapse (orthogonal, upward prune)
    collapsedPersonIds.forEach((id) => {
      getAncestors(id, relationships).forEach((aid) => hidden.add(aid));
    });
    return hidden;
  }, [rootId, relationships, persons, expandedSiblingIds, collapsedPersonIds]);
```

- [ ] **Step 7: Update the `buildTreeData` call**

Replace the callbacks object in the `buildTreeData` call (lines 535-544) with:

```ts
    {
      onAddRelative: readOnly ? undefined : handleAddRelative,
      onSelect: handleSelect,
      onToggleCollapse: toggleCollapse,
      collapsedPersonIds,
      siblingInfo,
      onToggleSiblings: toggleSiblings,
    },
```

- [ ] **Step 8: Typecheck + lint + full test**

Run: `npm run lint`
Expected: no errors, no unused-var warnings for `getDescendants` / removed symbols.

Run: `npm run build`
Expected: compiles clean (page.tsx now matches the Task 2 `buildTreeData` signature).

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add "app/(dashboard)/trees/[treeId]/page.tsx"
git commit -m "feat: default to ancestor pedigree with collapsible collateral branches"
```

---

### Task 4: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open `http://localhost:3000`, log in, open a tree with at least 3 generations and some aunts/uncles.

> If `/api/auth` returns 404 or NextAuth throws "Unexpected token '<'", stop the dev server and wipe the whole `.next` directory (build/dev cache corruption), then `npm run dev` again.

- [ ] **Step 2: Verify default collapse**

Confirm on first load: only the root, its ancestor pedigree (parents, grandparents, …), and the root's own spouse/descendants are shown. No aunts/uncles/great-aunts visible. Each ancestor (and the root) with siblings shows a small circled count on its left card edge.

- [ ] **Step 3: Verify stepwise expand/collapse**

Click the circle on the father card → exactly the father's siblings (aunts/uncles) appear, paired with spouses where present; their children (cousins) stay hidden. The circle now shows `−`. Click again → they collapse. Repeat on a grandparent and on the root.

- [ ] **Step 4: Verify persistence + no overlap**

Expand two or three branches, reload the page → the same branches stay expanded (localStorage). Confirm no node overlaps after expansion. Click the toolbar "Expand all" → all sibling branches and collapsed ancestors reveal.

- [ ] **Step 5: Final quality gate**

Run: `npm run lint && npm test && npm run build`
Expected: all pass.

Report verification results (with the actual command output) before declaring the feature complete.
