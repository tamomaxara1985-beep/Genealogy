# Collapse Root Person's Siblings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the tree root person's siblings (full + half) by default, with a chevron+count badge on the root node to expand/collapse them.

**Architecture:** Pure helpers compute the root person (earliest `createdAt`) and their siblings + descendant subtrees. The tree page merges those IDs into the existing `hiddenIds` filter when collapsed (default), and threads root/badge data through `buildTreeData` to the root node's card. Additive to the existing ancestor-collapse — same `hiddenIds` set, union semantics.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, `@xyflow/react`, SWR, localStorage. No test runner — pure helpers verified with throwaway `npx tsx` check scripts; UI verified manually in the browser.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/types`.
- No DB/API/schema changes. Root + expansion state are client-side only.
- Persist expansion state to `localStorage` key `tree-root-siblings-${treeId}` (boolean), default `false` (collapsed).
- Siblings = anyone sharing **≥1** parent with root (full + half), excluding root.
- Root = person with smallest `createdAt`; `null` for empty list.
- The root person must never be hidden.
- Existing ancestor-collapse (`getAncestors`, top-center chevron, `tree-collapsed-${treeId}`) stays untouched.
- Match existing node-button styling: `nodrag nopan`, `e.stopPropagation()`, amber hover (`hover:border-amber-400 hover:text-amber-700`).

---

### Task 1: Pure helpers — `getDescendants` and `getSiblings`

**Files:**
- Modify: `lib/treeCollapse.ts` (append two functions)
- Check (temporary, not committed): `lib/treeCollapse.check.ts`

**Interfaces:**
- Consumes: `IRelationship` from `@/types` (already imported in the file).
- Produces:
  - `getDescendants(personId: string, relationships: IRelationship[]): Set<string>` — BFS downward; excludes `personId`.
  - `getSiblings(personId: string, relationships: IRelationship[]): Set<string>` — IDs sharing ≥1 parent with `personId`; excludes `personId`; empty set if `personId` has no parents.

- [ ] **Step 1: Write the failing check script**

Create `lib/treeCollapse.check.ts`:

```ts
import { getDescendants, getSiblings } from "./treeCollapse";
import type { IRelationship } from "@/types";

function rel(person1Id: string, person2Id: string): IRelationship {
  return { _id: `${person1Id}-${person2Id}`, treeId: "t", type: "parent-child", person1Id, person2Id };
}

// dad+mom -> root, sibA (full), and dad+stepmom -> sibB (half)
// root -> kidOfRoot ; sibA -> kidOfSibA
const rels: IRelationship[] = [
  rel("dad", "root"), rel("mom", "root"),
  rel("dad", "sibA"), rel("mom", "sibA"),
  rel("dad", "sibB"), rel("stepmom", "sibB"),
  rel("root", "kidOfRoot"),
  rel("sibA", "kidOfSibA"),
];

const sibs = getSiblings("root", rels);
console.assert(sibs.has("sibA"), "full sibling sibA missing");
console.assert(sibs.has("sibB"), "half sibling sibB missing");
console.assert(!sibs.has("root"), "root must not be its own sibling");
console.assert(sibs.size === 2, `expected 2 siblings, got ${sibs.size}`);

const desc = getDescendants("sibA", rels);
console.assert(desc.has("kidOfSibA"), "descendant kidOfSibA missing");
console.assert(!desc.has("sibA"), "self must not be a descendant");
console.assert(desc.size === 1, `expected 1 descendant, got ${desc.size}`);

const noParent = getSiblings("dad", rels);
console.assert(noParent.size === 0, `parentless person has no siblings, got ${noParent.size}`);

console.log("ALL CHECKS PASSED");
```

- [ ] **Step 2: Run the check to verify it fails**

Run: `npx tsx lib/treeCollapse.check.ts`
Expected: FAIL — `getDescendants`/`getSiblings` not exported (import/runtime error).

- [ ] **Step 3: Append the implementation to `lib/treeCollapse.ts`**

```ts
/**
 * BFS downward through parent-child edges.
 * Returns IDs of all descendants of personId (not including personId itself).
 */
export function getDescendants(
  personId: string,
  relationships: IRelationship[]
): Set<string> {
  const descendants = new Set<string>();
  const queue = [personId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const r of relationships) {
      if (
        r.type === "parent-child" &&
        r.person1Id === cur &&
        !descendants.has(r.person2Id) &&
        r.person2Id !== personId
      ) {
        descendants.add(r.person2Id);
        queue.push(r.person2Id);
      }
    }
  }
  return descendants;
}

/**
 * Siblings of personId: anyone sharing at least one parent (full + half).
 * Excludes personId itself. Empty if personId has no recorded parents.
 */
export function getSiblings(
  personId: string,
  relationships: IRelationship[]
): Set<string> {
  const parents = new Set<string>();
  for (const r of relationships) {
    if (r.type === "parent-child" && r.person2Id === personId) {
      parents.add(r.person1Id);
    }
  }
  const siblings = new Set<string>();
  if (parents.size === 0) return siblings;
  for (const r of relationships) {
    if (
      r.type === "parent-child" &&
      parents.has(r.person1Id) &&
      r.person2Id !== personId
    ) {
      siblings.add(r.person2Id);
    }
  }
  return siblings;
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `npx tsx lib/treeCollapse.check.ts`
Expected: prints `ALL CHECKS PASSED` with no assertion errors.

- [ ] **Step 5: Delete the check script and commit**

```bash
rm lib/treeCollapse.check.ts
git add lib/treeCollapse.ts
git commit -m "feat: getSiblings and getDescendants tree helpers"
```

---

### Task 2: Root resolver — `lib/treeRoot.ts`

**Files:**
- Create: `lib/treeRoot.ts`
- Check (temporary, not committed): `lib/treeRoot.check.ts`

**Interfaces:**
- Consumes: `IPerson` from `@/types` (has `createdAt: Date` typed; arrives as an ISO string over JSON — `new Date(...)` handles both).
- Produces: `getRootPersonId(persons: IPerson[]): string | null` — `_id` of the earliest-created person, or `null` when empty.

- [ ] **Step 1: Write the failing check script**

Create `lib/treeRoot.check.ts`:

```ts
import { getRootPersonId } from "./treeRoot";
import type { IPerson } from "@/types";

function person(_id: string, createdAt: string): IPerson {
  return {
    _id, treeId: "t", firstName: _id, lastName: "x",
    gender: "unknown", isLiving: true,
    createdAt: createdAt as unknown as Date,
    updatedAt: createdAt as unknown as Date,
  };
}

const people: IPerson[] = [
  person("b", "2024-05-01T00:00:00Z"),
  person("a", "2024-01-01T00:00:00Z"),
  person("c", "2024-09-01T00:00:00Z"),
];

console.assert(getRootPersonId(people) === "a", `expected a, got ${getRootPersonId(people)}`);
console.assert(getRootPersonId([]) === null, "empty list must be null");
console.log("ALL CHECKS PASSED");
```

- [ ] **Step 2: Run the check to verify it fails**

Run: `npx tsx lib/treeRoot.check.ts`
Expected: FAIL — module `./treeRoot` not found.

- [ ] **Step 3: Create `lib/treeRoot.ts`**

```ts
import type { IPerson } from "@/types";

/**
 * Root / home person of a tree = earliest-created person.
 * Returns null for an empty list.
 */
export function getRootPersonId(persons: IPerson[]): string | null {
  if (persons.length === 0) return null;
  let root = persons[0];
  for (const p of persons) {
    if (new Date(p.createdAt).getTime() < new Date(root.createdAt).getTime()) {
      root = p;
    }
  }
  return root._id;
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `npx tsx lib/treeRoot.check.ts`
Expected: prints `ALL CHECKS PASSED`.

- [ ] **Step 5: Delete the check script and commit**

```bash
rm lib/treeRoot.check.ts
git add lib/treeRoot.ts
git commit -m "feat: getRootPersonId resolver"
```

---

### Task 3: Thread root/sibling data through `buildTreeData`

**Files:**
- Modify: `lib/buildTreeData.ts`

**Interfaces:**
- Consumes: `getRootPersonId`, `getSiblings` (Tasks 1–2) — used by the page in Task 4, not here.
- Produces (extends `Callbacks`):
  - `rootPersonId?: string | null`
  - `rootSiblingCount?: number`
  - `rootSiblingsExpanded?: boolean`
  - `onToggleRootSiblings?: () => void`
- Produces on node `data`:
  - PersonNode `data`: `isRoot?: boolean`, `rootSiblingCount?: number`, `rootSiblingsExpanded?: boolean`, `onToggleRootSiblings?: () => void`.
  - CoupleNode `data`: `rootSlot?: 1 | 2`, `rootSiblingCount?: number`, `rootSiblingsExpanded?: boolean`, `onToggleRootSiblings?: () => void`.

- [ ] **Step 1: Extend the `Callbacks` interface**

In `lib/buildTreeData.ts`, replace the `Callbacks` interface (lines ~8-13) with:

```ts
interface Callbacks {
  onAddRelative?: (personId: string, role: RelativeRole, personId2?: string) => void;
  onSelect: (person: IPerson) => void;
  onToggleCollapse?: (personId: string) => void;
  collapsedPersonIds?: Set<string>;
  rootPersonId?: string | null;
  rootSiblingCount?: number;
  rootSiblingsExpanded?: boolean;
  onToggleRootSiblings?: () => void;
}
```

- [ ] **Step 2: Add a root-badge helper near the top of `buildTreeData`'s body**

Immediately after `const hasFilter = highlighted.size > 0;` add:

```ts
  const hasRootBadge = (callbacks.rootSiblingCount ?? 0) > 0;
  const isRootPerson = (id: string) =>
    hasRootBadge && callbacks.rootPersonId === id;
```

- [ ] **Step 3: Pass badge data into the CoupleNode `data` object**

In the `coupleNodes.push({ ... data: { ... } })` block, add these fields to `data` (alongside `isCollapsed2`):

```ts
          rootSlot: isRootPerson(p1._id) ? 1 : isRootPerson(p2._id) ? 2 : undefined,
          rootSiblingCount:
            isRootPerson(p1._id) || isRootPerson(p2._id)
              ? callbacks.rootSiblingCount
              : undefined,
          rootSiblingsExpanded: callbacks.rootSiblingsExpanded,
          onToggleRootSiblings: callbacks.onToggleRootSiblings,
```

(Note: `p1`/`p2` here are post-gender-swap, so the slot reflects the rendered card order.)

- [ ] **Step 4: Pass badge data into the PersonNode `data` object**

In the `personNodes` `.map(...)` `data: { ... }` block, add (alongside `isCollapsed`):

```ts
          isRoot: isRootPerson(p._id),
          rootSiblingCount: isRootPerson(p._id) ? callbacks.rootSiblingCount : undefined,
          rootSiblingsExpanded: isRootPerson(p._id) ? callbacks.rootSiblingsExpanded : undefined,
          onToggleRootSiblings: isRootPerson(p._id) ? callbacks.onToggleRootSiblings : undefined,
```

- [ ] **Step 5: Verify the build typechecks**

Run: `npm run build`
Expected: build fails on `PersonNodeType` / `CoupleNodeType` not declaring the new `data` fields. This is expected — the node types are extended in Task 5. Confirm the errors are ONLY about the new `data` properties on those two node types, then proceed (do not commit yet — Task 5 completes the type changes).

> If you prefer a green commit here, do Task 5 before building. Tasks 3 and 5 form one reviewable unit; commit them together at the end of Task 5.

---

### Task 4: Wire state + hidden-IDs merge in the tree page

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

**Interfaces:**
- Consumes: `getRootPersonId` (`@/lib/treeRoot`), `getSiblings`, `getDescendants` (`@/lib/treeCollapse`).
- Produces: passes `rootPersonId`, `rootSiblingCount`, `rootSiblingsExpanded`, `onToggleRootSiblings` into the existing `buildTreeData(...)` call.

- [ ] **Step 1: Add imports**

At the top, change the `getAncestors` import line:

```ts
import { getAncestors, getSiblings, getDescendants } from "@/lib/treeCollapse";
import { getRootPersonId } from "@/lib/treeRoot";
```

- [ ] **Step 2: Add expansion state**

Below the `collapsedPersonIds` state (line ~174) add:

```ts
  const [rootSiblingsExpanded, setRootSiblingsExpanded] = useState(false);
```

- [ ] **Step 3: Load/save expansion state to localStorage**

After the existing collapsed-state effects (line ~196) add:

```ts
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`tree-root-siblings-${treeId}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setRootSiblingsExpanded(JSON.parse(stored) === true);
    } catch {}
  }, [treeId]);

  useEffect(() => {
    localStorage.setItem(
      `tree-root-siblings-${treeId}`,
      JSON.stringify(rootSiblingsExpanded)
    );
  }, [rootSiblingsExpanded, treeId]);
```

- [ ] **Step 4: Derive root + siblings and the toggle**

After `toggleCollapse` / `expandAll` (line ~235) add:

```ts
  const rootId = useMemo(() => getRootPersonId(persons), [persons]);

  const rootSiblingIds = useMemo(
    () => (rootId ? getSiblings(rootId, relationships) : new Set<string>()),
    [rootId, relationships]
  );

  const toggleRootSiblings = useCallback(() => {
    setRootSiblingsExpanded((v) => !v);
  }, []);
```

- [ ] **Step 5: Merge hidden siblings into `hiddenIds`**

Replace the existing `hiddenIds` `useMemo` (lines ~265-271) with:

```ts
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    collapsedPersonIds.forEach((id) => {
      getAncestors(id, relationships).forEach((aid) => hidden.add(aid));
    });
    if (!rootSiblingsExpanded) {
      rootSiblingIds.forEach((sibId) => {
        hidden.add(sibId);
        getDescendants(sibId, relationships).forEach((d) => hidden.add(d));
      });
    }
    return hidden;
  }, [collapsedPersonIds, relationships, rootSiblingsExpanded, rootSiblingIds]);
```

- [ ] **Step 6: Pass badge data into `buildTreeData`**

In the `buildTreeData(visiblePersons, visibleRelationships, { ... }, highlighted)` call, add to the callbacks object (after `collapsedPersonIds,`):

```ts
      rootPersonId: rootId,
      rootSiblingCount: rootSiblingIds.size,
      rootSiblingsExpanded,
      onToggleRootSiblings: toggleRootSiblings,
```

- [ ] **Step 7: Verify typecheck/build**

Run: `npm run build`
Expected: same node-`data`-type errors as Task 3 Step 5 (resolved in Task 5). No NEW errors in `page.tsx` itself. Do not commit yet.

---

### Task 5: Root badge UI on the nodes

**Files:**
- Modify: `components/tree/PersonNode.tsx`
- Modify: `components/tree/CoupleNode.tsx`

**Interfaces:**
- Consumes: the `data` fields produced in Task 3.
- Produces: a clickable chevron+count pill on the root person's card calling `onToggleRootSiblings`.

- [ ] **Step 1: Extend `PersonNodeType` data**

In `components/tree/PersonNode.tsx`, add to the `Node<{...}>` data type (after `isCollapsed?: boolean;`):

```ts
    isRoot?: boolean;
    rootSiblingCount?: number;
    rootSiblingsExpanded?: boolean;
    onToggleRootSiblings?: () => void;
```

- [ ] **Step 2: Render the pill in `PersonNode`**

In `PersonNode`, extend the destructure:

```ts
  const { person, onAddRelative, onSelect, onToggleCollapse, isCollapsed, isRoot, rootSiblingCount, rootSiblingsExpanded, onToggleRootSiblings } = data;
```

Then, immediately after the collapsed-ancestors indicator block (after the `{isCollapsed && (...)}` JSX, ~line 101), add:

```tsx
      {/* Root siblings toggle — right side of root card only */}
      {isRoot && onToggleRootSiblings && (rootSiblingCount ?? 0) > 0 && (
        <button
          className="nodrag nopan absolute top-1/2 -translate-y-1/2 -right-14 z-10 flex items-center gap-1 bg-white border border-gray-300 rounded-full shadow-sm px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 transition-colors"
          onClick={(e) => { e.stopPropagation(); onToggleRootSiblings(); }}
          title={rootSiblingsExpanded ? "Hide siblings" : `Show ${rootSiblingCount} sibling${rootSiblingCount === 1 ? "" : "s"}`}
        >
          {rootSiblingsExpanded
            ? <ChevronUp size={11} className="text-gray-500" />
            : <ChevronDown size={11} className="text-gray-500" />}
          <span>{rootSiblingCount}</span>
        </button>
      )}
```

(`ChevronUp`/`ChevronDown` are already imported in this file.)

- [ ] **Step 3: Extend `CoupleNodeType` data**

In `components/tree/CoupleNode.tsx`, add to the `Node<{...}>` data type (after `isCollapsed2?: boolean;`):

```ts
    rootSlot?: 1 | 2;
    rootSiblingCount?: number;
    rootSiblingsExpanded?: boolean;
    onToggleRootSiblings?: () => void;
```

- [ ] **Step 4: Render the pill in `CoupleNode`**

Extend the destructure:

```ts
  const { person1, person2, onAddRelative, onSelect, isDivorced, divorceDate, onToggleCollapse, isCollapsed1, isCollapsed2, rootSlot, rootSiblingCount, rootSiblingsExpanded, onToggleRootSiblings } = data;
```

Then, immediately after the collapsed-ancestor indicators block (after the `{isCollapsed2 && (...)}` JSX, ~line 224), add:

```tsx
      {/* Root siblings toggle — below the root spouse's card (left card center 80px, right card center 300px) */}
      {rootSlot && onToggleRootSiblings && (rootSiblingCount ?? 0) > 0 && (
        <button
          className="nodrag nopan absolute -bottom-8 z-10 flex items-center gap-1 bg-white border border-gray-300 rounded-full shadow-sm px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 transition-colors"
          style={{ left: rootSlot === 1 ? 56 : 276 }}
          onClick={(e) => { e.stopPropagation(); onToggleRootSiblings(); }}
          title={rootSiblingsExpanded ? "Hide siblings" : `Show ${rootSiblingCount} sibling${rootSiblingCount === 1 ? "" : "s"}`}
        >
          {rootSiblingsExpanded
            ? <ChevronUp size={11} className="text-gray-500" />
            : <ChevronDown size={11} className="text-gray-500" />}
          <span>{rootSiblingCount}</span>
        </button>
      )}
```

- [ ] **Step 5: Verify the build is green**

Run: `npm run build`
Expected: PASS, no type errors (the `data`-type errors from Tasks 3–4 are now resolved).

- [ ] **Step 6: Commit Tasks 3–5 together**

```bash
git add lib/buildTreeData.ts "app/(dashboard)/trees/[treeId]/page.tsx" components/tree/PersonNode.tsx components/tree/CoupleNode.tsx
git commit -m "feat: collapse root person's siblings by default with expand badge"
```

---

### Task 6: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background). Wait for `Ready`. Open `http://localhost:3000`, log in, open a tree where the first-added person has at least one sibling and at least one parent.

- [ ] **Step 2: Verify default-collapsed**

Expected: on load, the root person's siblings (and their descendant subtrees) are NOT shown; the root's mother/father ARE shown. A chevron+count pill appears on the root person's card showing the hidden-sibling count.

- [ ] **Step 3: Verify expand/collapse**

Click the pill. Expected: siblings appear; chevron flips to up. Click again: siblings hide; chevron flips to down. Layout re-fits each time.

- [ ] **Step 4: Verify persistence**

Expand siblings, reload the page. Expected: siblings stay expanded (state persisted). Collapse, reload. Expected: stays collapsed.

- [ ] **Step 5: Verify negative cases**

Open/inspect a tree state where the root has no parents (thus no detectable siblings) or zero siblings. Expected: NO pill on the root card, nothing hidden by this feature.

- [ ] **Step 6: Verify no regression in ancestor-collapse**

Select a non-root node, click its top-center chevron. Expected: its ancestors hide/show exactly as before, independent of the sibling badge.

- [ ] **Step 7: Stop the dev server**

Stop the background dev task.

---

## Self-Review

**Spec coverage:**
- "Root = earliest createdAt" → Task 2. ✓
- "Siblings = share ≥1 parent (full+half)" → Task 1 `getSiblings`. ✓
- "Hide sibling + descendant subtree" → Task 1 `getDescendants` + Task 4 Step 5 merge. ✓
- "Default collapsed, localStorage persistence" → Task 4 Steps 2-3. ✓
- "Chevron+count badge on root node" → Task 5. ✓
- "Badge on root's specific card in a couple" → Task 3 `rootSlot` + Task 5 Step 4. ✓
- "No badge when no siblings / no parents / empty tree" → guarded by `rootSiblingCount > 0` (Task 3 `hasRootBadge`, Task 5 conditionals) and `getRootPersonId` null. ✓
- "Ancestor-collapse untouched, union semantics" → Task 4 Step 5 keeps the `getAncestors` loop, adds to same set. ✓
- "No DB/API/schema changes" → no model/route tasks. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases" — every code step shows full code. ✓

**Type consistency:** `rootPersonId`/`rootSiblingCount`/`rootSiblingsExpanded`/`onToggleRootSiblings` names identical across Callbacks (Task 3), page call (Task 4 Step 6), and node `data` (Task 5). PersonNode uses `isRoot`; CoupleNode uses `rootSlot: 1 | 2` — both documented in Task 3 Interfaces and consumed in Task 5. ✓

**Note on commit grouping:** Tasks 3–5 are one reviewable unit (the build only goes green after Task 5); they share a single commit at Task 5 Step 6. Tasks 1, 2, and 6 are independent.
