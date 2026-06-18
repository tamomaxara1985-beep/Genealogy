# Expand All Collapsed Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Expand All" button to the tree toolbar that clears all collapsed ancestor branches at once.

**Architecture:** Two-file change. `TreeToolbar.tsx` gains two new props (`collapsedCount`, `onExpandAll`) and renders a button when `collapsedCount > 0`. `page.tsx` adds an `expandAll` callback and passes the new props down. The existing `useEffect` that persists `collapsedPersonIds` to localStorage handles clearing automatically when the state is set to an empty Set.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Next.js 16 App Router.

---

## File Map

| File | Change |
|------|--------|
| `components/tree/TreeToolbar.tsx` | Add 2 props to interface; render "Expand All" button |
| `app/(dashboard)/trees/[treeId]/page.tsx` | Add `expandAll` callback; pass new props to `<TreeToolbar>` |

---

### Task 1: Add props and button to TreeToolbar

**Files:**
- Modify: `components/tree/TreeToolbar.tsx:15-19` (Props interface)
- Modify: `components/tree/TreeToolbar.tsx:21` (destructure)
- Modify: `components/tree/TreeToolbar.tsx:79-91` (render — after surname filter)

- [ ] **Step 1: Update Props interface**

Find (lines 15–19):
```ts
interface Props {
  persons: IPerson[];
  onHighlight: (ids: Set<string>) => void;
  onSurnameFilter: (surname: string | null) => void;
}
```

Replace with:
```ts
interface Props {
  persons: IPerson[];
  onHighlight: (ids: Set<string>) => void;
  onSurnameFilter: (surname: string | null) => void;
  collapsedCount: number;
  onExpandAll: () => void;
}
```

- [ ] **Step 2: Destructure new props**

Find (line 21):
```ts
export function TreeToolbar({ persons, onHighlight, onSurnameFilter }: Props) {
```

Replace with:
```ts
export function TreeToolbar({ persons, onHighlight, onSurnameFilter, collapsedCount, onExpandAll }: Props) {
```

- [ ] **Step 3: Render Expand All button**

Find (lines 90–91, after the surname filter closing `}`):
```tsx
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
```

Replace with:
```tsx
        )}
        {collapsedCount > 0 && (
          <button
            onClick={onExpandAll}
            className="text-xs px-3 py-1.5 rounded-md border border-amber-400 text-amber-600 hover:bg-amber-50 transition-colors whitespace-nowrap"
          >
            Expand All
          </button>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
```

- [ ] **Step 4: Build check**

```bash
cd "c:\Users\User\Desktop\Genealogy" && npm run build 2>&1 | tail -20
```

Expected: build fails or warns on `page.tsx` because `TreeToolbar` now requires `collapsedCount` and `onExpandAll` but `page.tsx` doesn't pass them yet. TypeScript error is expected at this step — that's fine, it confirms the props are wired.

---

### Task 2: Wire expandAll in page.tsx + commit

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx` — add `expandAll` callback near `toggleCollapse`
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx:446` — update `<TreeToolbar>` call

- [ ] **Step 1: Add expandAll callback**

Find the `toggleCollapse` callback (around line 217):
```ts
const toggleCollapse = useCallback((personId: string) => {
  setCollapsedPersonIds((prev) => {
    const next = new Set(prev);
    next.has(personId) ? next.delete(personId) : next.add(personId);
    return next;
  });
}, []);
```

Insert immediately after it:
```ts
const expandAll = useCallback(() => {
  setCollapsedPersonIds(new Set());
}, []);
```

- [ ] **Step 2: Pass new props to TreeToolbar**

Find (around line 446):
```tsx
<TreeToolbar persons={persons} onHighlight={setHighlighted} onSurnameFilter={setActiveSurname} />
```

Replace with:
```tsx
<TreeToolbar
  persons={persons}
  onHighlight={setHighlighted}
  onSurnameFilter={setActiveSurname}
  collapsedCount={collapsedPersonIds.size}
  onExpandAll={expandAll}
/>
```

- [ ] **Step 3: Build check**

```bash
cd "c:\Users\User\Desktop\Genealogy" && npm run build 2>&1 | tail -20
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Manual smoke test**

Start dev server (`npm run dev`), open a tree with multiple people, collapse a few ancestor branches using the chevron buttons above nodes. Confirm:
- "Expand All" button appears in the toolbar
- Clicking it expands all branches
- Button disappears after expanding (no collapsed nodes remain)
- Re-collapsing a node makes button reappear

- [ ] **Step 5: Commit**

```bash
cd "c:\Users\User\Desktop\Genealogy"
git add "components/tree/TreeToolbar.tsx" "app/(dashboard)/trees/[treeId]/page.tsx"
git commit -m "feat: add Expand All button to tree toolbar"
```
