# Existing Co-Parent Selector When Adding Child

**Date:** 2026-06-16  
**Status:** Approved

## Problem

The Parents selector (added previously) shows existing spouses and a single-parent fallback. If the user wants to link a new child to an existing person in the tree who is not yet a spouse, there's no way to do that without first manually linking a spouse relationship.

## Scope

- Affects: `app/(dashboard)/trees/[treeId]/page.tsx` only
- No changes to: API routes, Relationship model, CoupleNode, PersonNode, buildTreeData

## Behavior

The Parents radio list gains a third option:

```
○  [Person A] and [Spouse B]          ← existing spouse (unchanged, if any)
○  [Person A] and Unknown mother      ← single-parent fallback (unchanged)
○  [Person A] and [Select person ▼]   ← NEW
```

### New option

- Always present as the last radio option (below spouse options and single-parent option)
- Label: `"{pendingName} and Select existing person"` initially
- Contains an inline `<Select>` dropdown listing all persons in the tree except `pendingFromId`
- When user picks a person from the dropdown:
  - `existingCoParentId` is set to the chosen person's `_id`
  - The "select existing person" radio auto-selects (it becomes the active option)
  - `selectedParentIds` is updated: `[pendingFromId, chosenId]` if pending is male, `[chosenId, pendingFromId]` if pending is female (matches existing gender ordering from `buildParentOptions`)
- Submit creates two `parent-child` rels (existing loop logic — no change)
- No spouse relationship is created between the two parents

### Deduplication

If the user previously selected an existing spouse via a spouse-option radio, then switches to the "select existing person" radio and picks the same spouse — that's fine. The submit logic is identical: loop over `selectedParentIds`.

### State

New state: `existingCoParentId: string` — the person ID chosen in the "select existing person" dropdown. Empty string = no selection (radio option disabled until a person is chosen).

When "select existing person" radio is active and `existingCoParentId` changes → recompute `selectedParentIds`.

## Data Flow

All data already in scope in `page.tsx`:
- `persons: IPerson[]` — populate the dropdown (exclude `pendingFromId`)
- `selectedParentIds: string[]` — updated when dropdown selection changes
- `pendingFromId: string` — determines ordering (male left, female right)

## UI Details

The existing-person radio row renders as two elements on one line:
- Static label: `"{pendingName} and"` 
- Inline `<Select>` dropdown: placeholder `"Select person…"`, lists all persons except `pendingFromId`

The radio is auto-selected when user picks from the dropdown. While `existingCoParentId` is empty the radio is disabled (cannot be manually clicked to select it).

## Changes

### `buildParentOptions` return type

Add `isExistingPersonSlot?: boolean` flag to the returned option objects so the radio UI knows which option to render as the dropdown variant:

```ts
Array<{ ids: string[]; label: string; isExistingPersonSlot?: boolean }>
```

The existing-person slot option is appended last with `ids: []` (empty placeholder — `selectedParentIds` is NOT read from this option's `ids`; instead the dialog computes it from `existingCoParentId` directly when that state changes) and `isExistingPersonSlot: true`.

### Dialog JSX

- New state: `const [existingCoParentId, setExistingCoParentId] = useState("")`
- When `existingCoParentId` changes and the existing-person radio is selected: update `selectedParentIds`
- Reset `existingCoParentId` on dialog close

## What Does NOT Change

- `submitNewPerson` son/daughter loop — unchanged
- API routes — unchanged
- Relationship model — unchanged
- CoupleNode / PersonNode — unchanged
- `handleAddRelative` — unchanged
- All non-child roles — unchanged
