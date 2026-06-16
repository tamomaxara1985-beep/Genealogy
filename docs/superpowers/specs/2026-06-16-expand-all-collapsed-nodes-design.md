# Expand All Collapsed Nodes

**Date:** 2026-06-16  
**Status:** Approved

## Problem

The family tree supports collapsing ancestor branches per person. When multiple branches are collapsed, there is no way to expand them all at once — the user must click each collapse toggle individually.

## Scope

- Affects: `components/tree/TreeToolbar.tsx`, `app/(dashboard)/trees/[treeId]/page.tsx`
- No changes to: collapse logic, `buildTreeData`, `treeCollapse`, node components, API routes

## Behavior

An "Expand All" button appears in the `TreeToolbar` when at least one person is collapsed. Clicking it expands all collapsed branches at once.

- Button is **hidden** when `collapsedPersonIds.size === 0` (no visual noise on a fully expanded tree)
- Button is **visible** when `collapsedPersonIds.size > 0`
- Click: clears `collapsedPersonIds` state → `setCollapsedPersonIds(new Set())` in page
- The existing `useEffect` that persists to `localStorage` fires automatically, clearing the stored key `tree-collapsed-${treeId}`
- No new state, no new API calls

## Changes

### `components/tree/TreeToolbar.tsx`

Add two props:

```ts
interface Props {
  persons: IPerson[];
  onHighlight: (ids: Set<string>) => void;
  onSurnameFilter: (surname: string | null) => void;
  collapsedCount: number;       // NEW
  onExpandAll: () => void;      // NEW
}
```

Add button (rendered after the surname filter, before/after the badges):

```tsx
{collapsedCount > 0 && (
  <button
    onClick={onExpandAll}
    className="text-xs px-3 py-1.5 rounded-md border border-amber-400 text-amber-600 hover:bg-amber-50 transition-colors whitespace-nowrap"
  >
    Expand All
  </button>
)}
```

### `app/(dashboard)/trees/[treeId]/page.tsx`

Add `expandAll` callback:

```ts
const expandAll = useCallback(() => {
  setCollapsedPersonIds(new Set());
}, []);
```

Pass new props to `TreeToolbar`:

```tsx
<TreeToolbar
  persons={persons}
  onHighlight={setHighlighted}
  onSurnameFilter={setActiveSurname}
  collapsedCount={collapsedPersonIds.size}
  onExpandAll={expandAll}
/>
```

## What Does NOT Change

- `toggleCollapse` — unchanged
- `collapsedPersonIds` state shape — unchanged
- localStorage persistence logic — unchanged (existing `useEffect` handles the clear automatically)
- Node components (`PersonNode`, `CoupleNode`) — unchanged
- All other toolbar functionality — unchanged
