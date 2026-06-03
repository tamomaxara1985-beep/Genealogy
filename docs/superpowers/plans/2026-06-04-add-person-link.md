# Add Person with Relationship Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When adding a new person via the standalone "+ Add Person" button, allow optionally linking them to an existing person as child, parent, or spouse — all in one submit.

**Architecture:** Single file change to `app/(dashboard)/trees/[treeId]/page.tsx`. Add two state vars (`linkToId`, `linkRole`), a `linkRoleToRelationship` helper, an `else if (linkToId)` branch in `submitNewPerson`, and an optional UI section in the dialog below `<PersonForm>`. The section is hidden when the node-click flow is active (`pendingRole` is set) or the tree has no persons yet.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, shadcn/ui Select.

---

## File Map

| File | Action |
|---|---|
| `app/(dashboard)/trees/[treeId]/page.tsx` | Modify — add state, helper, submit branch, dialog UI |

---

## Task 1: Implement link-on-creation in TreePage

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

- [ ] **Step 1: Read the current file**

Read `app/(dashboard)/trees/[treeId]/page.tsx` to confirm current state before editing.

- [ ] **Step 2: Add `linkRoleToRelationship` helper after `roleGender`**

Find this block (after the `roleGender` function, around line 58):

```typescript
function roleGender(role: RelativeRole): IPerson["gender"] {
  if (role === "father" || role === "son" || role === "brother") return "male";
  if (role === "mother" || role === "daughter" || role === "sister") return "female";
  return "unknown";
}
```

Insert this new function immediately after it:

```typescript
function linkRoleToRelationship(
  role: "child-of" | "parent-of" | "spouse-of",
  linkToId: string,
  newId: string
): { type: "parent-child" | "spouse"; person1Id: string; person2Id: string } {
  switch (role) {
    case "child-of":
      return { type: "parent-child", person1Id: linkToId, person2Id: newId };
    case "parent-of":
      return { type: "parent-child", person1Id: newId, person2Id: linkToId };
    case "spouse-of":
      return { type: "spouse", person1Id: linkToId, person2Id: newId };
  }
}
```

- [ ] **Step 3: Add `linkToId` and `linkRole` state**

Find the existing state declarations block (around lines 76–98). After this line:

```typescript
  const [pendingFromId, setPendingFromId] = useState<string | null>(null);
```

Add:

```typescript
  const [linkToId, setLinkToId] = useState("");
  const [linkRole, setLinkRole] = useState<"child-of" | "parent-of" | "spouse-of">("child-of");
```

- [ ] **Step 4: Reset link state on dialog close**

Find the dialog `onOpenChange` handler:

```typescript
        onOpenChange={(o) => {
          if (!o) { setAddPersonOpen(false); setPendingRole(null); setPendingFromId(null); }
        }}
```

Replace with:

```typescript
        onOpenChange={(o) => {
          if (!o) {
            setAddPersonOpen(false);
            setPendingRole(null);
            setPendingFromId(null);
            setLinkToId("");
            setLinkRole("child-of");
          }
        }}
```

- [ ] **Step 5: Update `submitNewPerson` to handle standalone link**

Find the current `submitNewPerson` function body after `const newPerson: IPerson = await res.json();`:

```typescript
    if (pendingFromId && pendingRole) {
      const rel = roleToRelationship(pendingRole, pendingFromId, newPerson._id);
      await fetch(`/api/trees/${treeId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rel),
      });
      await mutateRels();
      setPendingRole(null);
      setPendingFromId(null);
    } else {
      setAddPersonOpen(false);
    }

    await mutatePersons();
    setSaving(false);
```

Replace with:

```typescript
    if (pendingFromId && pendingRole) {
      const rel = roleToRelationship(pendingRole, pendingFromId, newPerson._id);
      await fetch(`/api/trees/${treeId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rel),
      });
      await mutateRels();
      setPendingRole(null);
      setPendingFromId(null);
    } else if (linkToId) {
      const rel = linkRoleToRelationship(linkRole, linkToId, newPerson._id);
      await fetch(`/api/trees/${treeId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rel),
      });
      await mutateRels();
    }

    setAddPersonOpen(false);
    setLinkToId("");
    setLinkRole("child-of");
    await mutatePersons();
    setSaving(false);
```

- [ ] **Step 6: Add link UI section in dialog**

Find inside the dialog content, after `<PersonForm ... />` and before `</DialogContent>`:

```typescript
          <PersonForm
            key={pendingRole ?? "standalone"}
            initial={{ gender: defaultGender }}
            onSubmit={submitNewPerson}
            loading={saving}
          />
        </DialogContent>
```

Replace with:

```typescript
          <PersonForm
            key={pendingRole ?? "standalone"}
            initial={{ gender: defaultGender }}
            onSubmit={submitNewPerson}
            loading={saving}
          />
          {!pendingRole && persons.length > 0 && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Link to existing person (optional)
              </p>
              <Select value={linkToId} onValueChange={(v) => setLinkToId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select person…" />
                </SelectTrigger>
                <SelectContent>
                  {persons.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {linkToId && (
                <Select
                  value={linkRole}
                  onValueChange={(v) => setLinkRole(v as typeof linkRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="child-of">Child of selected</SelectItem>
                    <SelectItem value="parent-of">Parent of selected</SelectItem>
                    <SelectItem value="spouse-of">Spouse of selected</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </DialogContent>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual smoke test**

1. Open `http://localhost:3000`, log in, open a tree with at least one person
2. Click "+ Add Person"
3. Verify "Link to existing person (optional)" section appears below the form
4. Select an existing person from the picker — verify role dropdown appears
5. Select "Child of selected", fill in name, click Save
6. Verify new person appears in tree AND is connected to selected person as their child
7. Test "Parent of selected" and "Spouse of selected" similarly
8. Click "+ Add Person" without selecting a link person — verify person saves standalone (no relationship)
9. Click "Add father" from a node — verify link section does NOT appear (pendingRole is set)

- [ ] **Step 9: Commit**

```bash
git add "app/(dashboard)/trees/[treeId]/page.tsx"
git commit -m "feat: allow linking new person to existing person on creation"
```
