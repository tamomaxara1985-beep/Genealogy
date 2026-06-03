# Add Person with Relationship Link — Design Spec

**Date:** 2026-06-04  
**Status:** Approved

## Overview

When adding a new person via the standalone "+ Add Person" button in the tree canvas, allow the user to optionally link the new person to an existing person in the tree as child, parent, or spouse — in one step, without needing a separate "Link people" flow.

## Decisions

| Question | Decision |
|---|---|
| Where link UI appears | Inside existing "+ Add Person" dialog, below PersonForm |
| When shown | Only in standalone mode (`!pendingRole && persons.length > 0`) |
| PersonForm changes | None |
| API changes | None |

---

## Changes: `app/(dashboard)/trees/[treeId]/page.tsx` only

### New state

```typescript
const [linkToId, setLinkToId] = useState("")
const [linkRole, setLinkRole] = useState<"child-of" | "parent-of" | "spouse-of">("child-of")
```

Reset both on dialog close alongside `setPendingRole(null)` and `setPendingFromId(null)`.

### New helper `linkRoleToRelationship`

```typescript
function linkRoleToRelationship(
  role: "child-of" | "parent-of" | "spouse-of",
  linkToId: string,
  newId: string
): { type: "parent-child" | "spouse"; person1Id: string; person2Id: string } {
  switch (role) {
    case "child-of":
      // existing person is parent, new person is child
      return { type: "parent-child", person1Id: linkToId, person2Id: newId }
    case "parent-of":
      // new person is parent, existing person is child
      return { type: "parent-child", person1Id: newId, person2Id: linkToId }
    case "spouse-of":
      return { type: "spouse", person1Id: linkToId, person2Id: newId }
  }
}
```

### Updated `submitNewPerson`

After creating the person, the existing `pendingFromId && pendingRole` branch handles the node-click flow. Add a new `else if` for the standalone link:

```typescript
if (pendingFromId && pendingRole) {
  // existing flow — node-click relative
  const rel = roleToRelationship(pendingRole, pendingFromId, newPerson._id)
  await fetch(`/api/trees/${treeId}/relationships`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rel) })
  await mutateRels()
  setPendingRole(null)
  setPendingFromId(null)
} else if (linkToId) {
  // new flow — standalone link
  const rel = linkRoleToRelationship(linkRole, linkToId, newPerson._id)
  await fetch(`/api/trees/${treeId}/relationships`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rel) })
  await mutateRels()
}
setAddPersonOpen(false)
setLinkToId("")
setLinkRole("child-of")
```

### Dialog UI addition

Below `<PersonForm>` inside the Add/Add-relative dialog, render when `!pendingRole && persons.length > 0`:

```tsx
{!pendingRole && persons.length > 0 && (
  <div className="border-t pt-4 space-y-3">
    <p className="text-sm font-medium text-muted-foreground">Link to existing person (optional)</p>
    <Select value={linkToId} onValueChange={(v) => setLinkToId(v ?? "")}>
      <SelectTrigger><SelectValue placeholder="Select person…" /></SelectTrigger>
      <SelectContent>
        {persons.map((p) => (
          <SelectItem key={p._id} value={p._id}>
            {p.firstName} {p.lastName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {linkToId && (
      <Select value={linkRole} onValueChange={(v) => setLinkRole(v as typeof linkRole)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="child-of">Child of selected</SelectItem>
          <SelectItem value="parent-of">Parent of selected</SelectItem>
          <SelectItem value="spouse-of">Spouse of selected</SelectItem>
        </SelectContent>
      </Select>
    )}
  </div>
)}
```

Role picker only appears after a person is selected (avoids showing orphaned dropdown).

## Files Changed

| File | Change |
|---|---|
| `app/(dashboard)/trees/[treeId]/page.tsx` | Add state, helper, dialog UI, updated submit |

## Out of Scope

- Linking to multiple existing persons at creation time
- Validation preventing duplicate relationships
