# Parents Selector When Adding Child

**Date:** 2026-06-16  
**Status:** Approved

## Problem

When user clicks "Add son/daughter" on a PersonNode, the child is linked only to that one person — even if that person has existing spouses. User should be able to select which parent combination the child belongs to, matching Ancestry.com behavior.

## Scope

- Affects: `app/(dashboard)/trees/[treeId]/page.tsx`
- No changes to: PersonForm, API routes, Relationship model, buildTreeData

## Behavior

### PersonNode → Add son/daughter
Show a "Parents" radio selector in the add-person dialog, below PersonForm:

**Options built from:**
1. Each existing spouse of `pendingFromId` → one option: `"{person} and {spouse}"`
2. Always include: `"{person} and Unknown {mother|father}"`

**Default selection:** first spouse option if any exist; otherwise the single-parent option.

**On submit:** create one `parent-child` relationship per parent in the selected option.
- Couple selected → two `parent-child` rels (one per parent)
- Single-parent selected → one `parent-child` rel

### CoupleNode → Add son/daughter
No selector shown. Both couple members are known. Create two `parent-child` rels automatically.

Currently CoupleNode calls `onAddRelative(person1._id, role)` — only one ID. Must extend the callback signature:
```ts
// Before
onAddRelative?: (personId: string, role: RelativeRole) => void
// After
onAddRelative?: (personId: string, role: RelativeRole, personId2?: string) => void
```
CoupleNode passes `person2._id` as `personId2` for son/daughter buttons. In `handleAddRelative`, presence of `personId2` means couple context → skip selector, `selectedParentIds = [personId, personId2]`.

## Data Flow

All data needed is already in scope in `page.tsx`:
- `persons: IPerson[]` — for displaying names
- `relationships: IRelationship[]` — filter `type === "spouse"` where `person1Id === pendingFromId` or `person2Id === pendingFromId`
- `pendingFromId: string` — the person the user clicked "Add child" on
- `pendingRole: RelativeRole` — "son" | "daughter"

New state: `selectedParentIds: string[]` — array of 1 or 2 personIds. Initialized when dialog opens: if couple context → `[personId, personId2]`; if PersonNode with spouses → `[pendingFromId, firstSpouseId]`; else → `[pendingFromId]`.

## UI

Radio group rendered inside the existing add-person dialog, below PersonForm content, only when `pendingRole === "son" || "daughter"`. Matches existing dialog styling.

Label format:
- Couple: `"{firstName} {lastName} and {spouseFirstName} {spouseLastName}"`
- Single (pending person is father): `"{firstName} {lastName} and Unknown mother"`
- Single (pending person is mother): `"Unknown father and {firstName} {lastName}"`

Gender of `pendingFromId` person determines label wording for the single-parent option.

## Relationship Creation (updated `submitNewPerson`)

```ts
// After creating person:
for (const parentId of selectedParentIds) {
  await fetch(`/api/trees/${treeId}/relationships`, {
    method: "POST",
    body: JSON.stringify({ type: "parent-child", person1Id: parentId, person2Id: newPerson._id }),
  });
}
```

Replaces the current `roleToRelationship` call for son/daughter roles. Other roles (father, mother, spouse, brother, sister) unchanged.

## What Does NOT Change

- PersonForm component — no new props
- API routes — no changes
- Relationship model — no changes
- buildTreeData — no changes
- CoupleNode / PersonNode components — no changes
- All non-child roles (father, mother, spouse, sibling) — unchanged flow
