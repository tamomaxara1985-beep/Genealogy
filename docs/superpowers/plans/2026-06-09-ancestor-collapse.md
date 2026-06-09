# Ancestor Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chevron button to every person node that collapses/expands all their ancestors, with state persisted per-tree in localStorage.

**Architecture:** Pure utility `getAncestors` (BFS upward) computes which nodes to hide; the tree page holds `collapsedPersonIds` state and filters `visiblePersons`/`visibleRelationships` before passing to `buildTreeData`; collapse callbacks flow through node data the same way `onAddRelative` does.

**Tech Stack:** React 19, TypeScript, React Flow (`@xyflow/react`), Tailwind CSS v4, lucide-react

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/treeCollapse.ts` | Create | BFS ancestor traversal utility |
| `components/tree/PersonNode.tsx` | Modify | Add `onToggleCollapse` + `isCollapsed` to type; render chevron button + collapsed indicator |
| `components/tree/CoupleNode.tsx` | Modify | Add `onToggleCollapse` + `isCollapsed1/2` to type; render per-person chevron buttons |
| `lib/buildTreeData.ts` | Modify | Extend `Callbacks` interface; pass `isCollapsed`/`onToggleCollapse` into node data |
| `app/(dashboard)/trees/[treeId]/page.tsx` | Modify | `collapsedPersonIds` state + localStorage sync + `hiddenIds` computation + filter chain |

---

## Task 1: getAncestors utility

**Files:**
- Create: `lib/treeCollapse.ts`

- [ ] **Step 1: Create the utility file**

```typescript
// lib/treeCollapse.ts
import type { IRelationship } from "@/types";

/**
 * BFS upward through parent-child edges.
 * Returns IDs of all ancestors of personId (not including personId itself).
 */
export function getAncestors(
  personId: string,
  relationships: IRelationship[]
): Set<string> {
  const ancestors = new Set<string>();
  const queue = [personId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const r of relationships) {
      if (r.type === "parent-child" && r.person2Id === cur && !ancestors.has(r.person1Id)) {
        ancestors.add(r.person1Id);
        queue.push(r.person1Id);
      }
    }
  }
  return ancestors;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors related to `lib/treeCollapse.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/treeCollapse.ts
git commit -m "feat: add getAncestors BFS utility for ancestor collapse"
```

---

## Task 2: PersonNode — collapse button + indicator

**Files:**
- Modify: `components/tree/PersonNode.tsx`

- [ ] **Step 1: Add new fields to `PersonNodeType`**

In `components/tree/PersonNode.tsx`, update the type:

```typescript
export type PersonNodeType = Node<
  {
    person: IPerson;
    onAddRelative?: (personId: string, role: RelativeRole) => void;
    onSelect?: (person: IPerson) => void;
    onToggleCollapse?: (personId: string) => void;
    isCollapsed?: boolean;
  },
  "personNode"
>;
```

- [ ] **Step 2: Add lucide-react import**

At the top of `components/tree/PersonNode.tsx`, add:

```typescript
import { ChevronUp, ChevronDown } from "lucide-react";
```

- [ ] **Step 3: Destructure new data fields in the component**

Change the destructure line inside `PersonNode`:

```typescript
export function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const { person, onAddRelative, onSelect, onToggleCollapse, isCollapsed } = data;
```

- [ ] **Step 4: Add collapse button and indicator above the card**

Inside the `return` of `PersonNode`, add this block immediately before the `{/* Card */}` comment:

```tsx
      {/* Collapse button */}
      {onToggleCollapse && (
        <button
          className="nodrag nopan absolute -top-7 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-300 shadow-sm hover:bg-gray-50 hover:border-amber-400 transition-colors"
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(person._id); }}
          title={isCollapsed ? "Show ancestors" : "Hide ancestors"}
        >
          {isCollapsed
            ? <ChevronDown size={11} className="text-gray-500" />
            : <ChevronUp size={11} className="text-gray-500" />}
        </button>
      )}
      {/* Collapsed ancestors indicator */}
      {isCollapsed && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-gray-300 text-[8px] tracking-[0.3em] select-none pointer-events-none">
          •••
        </div>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/tree/PersonNode.tsx
git commit -m "feat: add collapse button and indicator to PersonNode"
```

---

## Task 3: CoupleNode — per-person collapse buttons

**Files:**
- Modify: `components/tree/CoupleNode.tsx`

- [ ] **Step 1: Add new fields to `CoupleNodeType`**

Update the type in `components/tree/CoupleNode.tsx`:

```typescript
export type CoupleNodeType = Node<
  {
    person1: IPerson;
    person2: IPerson;
    onAddRelative?: (personId: string, role: RelativeRole) => void;
    onSelect?: (person: IPerson) => void;
    isDivorced?: boolean;
    divorceDate?: string;
    onToggleCollapse?: (personId: string) => void;
    isCollapsed1?: boolean;
    isCollapsed2?: boolean;
  },
  "coupleNode"
>;
```

- [ ] **Step 2: Add lucide-react import**

At the top of `components/tree/CoupleNode.tsx`, add:

```typescript
import { ChevronUp, ChevronDown } from "lucide-react";
```

- [ ] **Step 3: Destructure new fields in CoupleNode**

Update the destructure in `CoupleNode`:

```typescript
export function CoupleNode({ data, selected }: NodeProps<CoupleNodeType>) {
  const { person1, person2, onAddRelative, onSelect, isDivorced, divorceDate, onToggleCollapse, isCollapsed1, isCollapsed2 } = data;
```

- [ ] **Step 4: Add collapse buttons above the couple row**

Inside the `return` of `CoupleNode`, add this block immediately before the `<div className="flex items-center">` line (the couple row):

```tsx
      {/* Per-person collapse buttons */}
      {onToggleCollapse && (
        <>
          {/* person1 collapse button — centered above left card (card spans 0–160px, center = 80px) */}
          <button
            className="nodrag nopan absolute -top-7 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-300 shadow-sm hover:bg-gray-50 hover:border-amber-400 transition-colors"
            style={{ left: 70 }}
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(person1._id); }}
            title={isCollapsed1 ? "Show ancestors" : "Hide ancestors"}
          >
            {isCollapsed1
              ? <ChevronDown size={11} className="text-gray-500" />
              : <ChevronUp size={11} className="text-gray-500" />}
          </button>
          {/* person2 collapse button — centered above right card (card spans 220–380px, center = 300px) */}
          <button
            className="nodrag nopan absolute -top-7 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-300 shadow-sm hover:bg-gray-50 hover:border-amber-400 transition-colors"
            style={{ left: 290 }}
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(person2._id); }}
            title={isCollapsed2 ? "Show ancestors" : "Hide ancestors"}
          >
            {isCollapsed2
              ? <ChevronDown size={11} className="text-gray-500" />
              : <ChevronUp size={11} className="text-gray-500" />}
          </button>
        </>
      )}
      {/* Collapsed ancestor indicators */}
      {isCollapsed1 && (
        <div
          className="absolute -top-4 z-10 text-gray-300 text-[8px] tracking-[0.3em] select-none pointer-events-none"
          style={{ left: 57 }}
        >
          •••
        </div>
      )}
      {isCollapsed2 && (
        <div
          className="absolute -top-4 z-10 text-gray-300 text-[8px] tracking-[0.3em] select-none pointer-events-none"
          style={{ left: 277 }}
        >
          •••
        </div>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/tree/CoupleNode.tsx
git commit -m "feat: add per-person collapse buttons to CoupleNode"
```

---

## Task 4: buildTreeData — pass collapse fields into node data

**Files:**
- Modify: `lib/buildTreeData.ts`

- [ ] **Step 1: Extend the `Callbacks` interface**

In `lib/buildTreeData.ts`, update `Callbacks` (new fields optional so the file compiles before Task 5 wires them in):

```typescript
interface Callbacks {
  onAddRelative: (personId: string, role: RelativeRole) => void;
  onSelect: (person: IPerson) => void;
  onToggleCollapse?: (personId: string) => void;
  collapsedPersonIds?: Set<string>;
}
```

- [ ] **Step 2: Pass collapse fields into personNode data**

In the `personNodes` map (the `.filter().map()` block), update the `data` object:

```typescript
  const personNodes: PersonNodeType[] = persons
    .filter((p) => !usedInCouple.has(p._id))
    .map((p) => {
      const dim = hasFilter && !highlighted.has(p._id);
      return {
        id: p._id,
        type: "personNode",
        position: { x: 0, y: 0 },
        style: dim
          ? { opacity: 0.25, transition: "opacity 0.2s" }
          : { opacity: 1 },
        data: {
          person: p,
          onAddRelative: callbacks.onAddRelative,
          onSelect: callbacks.onSelect,
          onToggleCollapse: callbacks.onToggleCollapse,
          isCollapsed: callbacks.collapsedPersonIds?.has(p._id) ?? false,
        },
      } as PersonNodeType;
    });
```

- [ ] **Step 3: Pass collapse fields into coupleNode data**

In the `spouseRels.forEach` block, update the `coupleNodes.push(...)` call's `data` object:

```typescript
    coupleNodes.push({
      id: coupleId,
      type: "coupleNode",
      position: { x: 0, y: 0 },
      style: dim ? { opacity: 0.25, transition: "opacity 0.2s" } : { opacity: 1 },
      data: {
        person1: p1,
        person2: p2,
        onAddRelative: callbacks.onAddRelative,
        onSelect: callbacks.onSelect,
        isDivorced: !!r.endDate,
        divorceDate: r.endDate,
        onToggleCollapse: callbacks.onToggleCollapse,
        isCollapsed1: callbacks.collapsedPersonIds?.has(r.person1Id) ?? false,
        isCollapsed2: callbacks.collapsedPersonIds?.has(r.person2Id) ?? false,
      },
    } as CoupleNodeType);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. New Callbacks fields are optional so the page call site still compiles before Task 5 adds them.

- [ ] **Step 5: Commit**

```bash
git add lib/buildTreeData.ts
git commit -m "feat: thread collapse callbacks through buildTreeData node data"
```

---

## Task 5: Tree page — collapse state, hiddenIds filter, wire callbacks

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

- [ ] **Step 1: Add `getAncestors` import**

Add to the existing imports near the top of the file (after the `buildTreeData` import):

```typescript
import { getAncestors } from "@/lib/treeCollapse";
```

- [ ] **Step 2: Add `useMemo` to the React import**

The file already imports `use, useState, useCallback, useRef` from React. Add `useMemo`:

```typescript
import { use, useState, useCallback, useRef, useMemo, useEffect } from "react";
```

(Note: `useEffect` may already be imported — check and add only what's missing.)

- [ ] **Step 3: Add `collapsedPersonIds` state with localStorage initialization**

After the existing state declarations (after the `highlighted` and `activeSurname` state), add:

```typescript
  const [collapsedPersonIds, setCollapsedPersonIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`tree-collapsed-${treeId}`);
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
```

- [ ] **Step 4: Add localStorage sync effect**

After the state declaration, add:

```typescript
  useEffect(() => {
    localStorage.setItem(
      `tree-collapsed-${treeId}`,
      JSON.stringify([...collapsedPersonIds])
    );
  }, [collapsedPersonIds, treeId]);
```

- [ ] **Step 5: Add `toggleCollapse` callback**

After the `handleSelect` callback, add:

```typescript
  const toggleCollapse = useCallback((personId: string) => {
    setCollapsedPersonIds((prev) => {
      const next = new Set(prev);
      next.has(personId) ? next.delete(personId) : next.add(personId);
      return next;
    });
  }, []);
```

- [ ] **Step 6: Compute `hiddenIds` with useMemo**

After the `toggleCollapse` callback, add:

```typescript
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    collapsedPersonIds.forEach((id) => {
      getAncestors(id, relationships).forEach((aid) => hidden.add(aid));
    });
    return hidden;
  }, [collapsedPersonIds, relationships]);
```

- [ ] **Step 7: Rename existing surname-filter variables and chain collapse filter**

Find this existing block in the page:

```typescript
  const visiblePersons = (() => {
    if (!activeSurname) return persons;
    // ...existing logic...
  })();

  const visibleRelationships = activeSurname
    ? (() => { ... })()
    : relationships;

  const { nodes, edges } = buildTreeData(visiblePersons, visibleRelationships, { onAddRelative: handleAddRelative, onSelect: handleSelect }, highlighted);
```

Replace it with:

```typescript
  // Surname filter (unchanged logic, renamed variables)
  const surnamePersons = (() => {
    if (!activeSurname) return persons;
    const core = new Set(
      persons
        .filter((p) => p.lastName === activeSurname || p.maidenName === activeSurname)
        .map((p) => p._id)
    );
    const expanded = new Set(core);
    relationships.forEach((r) => {
      if (core.has(r.person1Id) || core.has(r.person2Id)) {
        expanded.add(r.person1Id);
        expanded.add(r.person2Id);
      }
    });
    return persons.filter((p) => expanded.has(p._id));
  })();

  const surnameRels = activeSurname
    ? (() => {
        const ids = new Set(surnamePersons.map((p) => p._id));
        return relationships.filter((r) => ids.has(r.person1Id) && ids.has(r.person2Id));
      })()
    : relationships;

  // Collapse filter — applied after surname filter
  const visiblePersons = surnamePersons.filter((p) => !hiddenIds.has(p._id));
  const visibleRelationships = surnameRels.filter(
    (r) => !hiddenIds.has(r.person1Id) && !hiddenIds.has(r.person2Id)
  );

  const { nodes, edges } = buildTreeData(
    visiblePersons,
    visibleRelationships,
    {
      onAddRelative: handleAddRelative,
      onSelect: handleSelect,
      onToggleCollapse: toggleCollapse,
      collapsedPersonIds,
    },
    highlighted
  );
```

- [ ] **Step 8: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Start dev server and manually test**

```bash
npm run dev
```

Open http://localhost:3000, navigate to a tree with multiple generations.

Manual checks:
1. Each person card shows a small `▲` button above it
2. Clicking `▲` on a person hides their parents (and grandparents)
3. Button changes to `▼` and `•••` indicator appears above collapsed card
4. Clicking `▼` restores the ancestors
5. Refresh page — collapsed state is restored from localStorage
6. Surname filter still works when ancestors are collapsed
7. CoupleNode shows two separate buttons — one per person

- [ ] **Step 10: Commit**

```bash
git add app/\(dashboard\)/trees/\[treeId\]/page.tsx
git commit -m "feat: wire ancestor collapse state and localStorage persistence to tree page"
```
