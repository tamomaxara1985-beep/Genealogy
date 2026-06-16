# Parents Selector When Adding Child — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When adding a son/daughter from a PersonNode, show a radio-button "Parents" selector listing that person's spouse combinations; from a CoupleNode, auto-link both parents without showing the selector.

**Architecture:** Two touch points: (1) CoupleNode passes the second person's ID as an optional third arg to `onAddRelative`; (2) `page.tsx` uses that signal to either skip the selector (couple context) or render radio options built from the person's existing spouse relationships. The helper `buildParentOptions` must be defined before `handleAddRelative` references it.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui, MongoDB/Mongoose `parent-child` | `spouse` relationships.

---

## File Map

| File | Change |
|------|--------|
| `components/tree/CoupleNode.tsx` | Update `onAddRelative` prop type; pass `person2._id` in child-button onClick |
| `app/(dashboard)/trees/[treeId]/page.tsx` | `buildParentOptions` helper, two new state vars, updated `handleAddRelative`, Parents radio UI, updated `submitNewPerson`, updated dialog-close reset |

---

### Task 1: Extend CoupleNode

**Files:**
- Modify: `components/tree/CoupleNode.tsx`

- [ ] **Step 1: Update the onAddRelative prop type (line 11)**

```ts
// Before
onAddRelative?: (personId: string, role: RelativeRole) => void;
// After
onAddRelative?: (personId: string, role: RelativeRole, personId2?: string) => void;
```

- [ ] **Step 2: Pass person2._id in the CHILD_BUTTONS onClick (line 231)**

```tsx
// Before
onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, role); }}
// After
onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, role, person2._id); }}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/tree/CoupleNode.tsx
git commit -m "feat: pass couple partner id from CoupleNode add-child buttons"
```

---

### Task 2: Add buildParentOptions helper to page.tsx

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx` — insert after `linkRoleToRelationship` (around line 77)

- [ ] **Step 1: Add the helper function**

Insert after the closing brace of `linkRoleToRelationship`:

```ts
function buildParentOptions(
  pendingFromId: string,
  persons: IPerson[],
  relationships: IRelationship[]
): Array<{ ids: string[]; label: string }> {
  const pending = persons.find((p) => p._id === pendingFromId);
  if (!pending) return [];

  const spouseRels = relationships.filter(
    (r) =>
      r.type === "spouse" &&
      (r.person1Id === pendingFromId || r.person2Id === pendingFromId)
  );

  const options: Array<{ ids: string[]; label: string }> = [];

  for (const rel of spouseRels) {
    const spouseId = rel.person1Id === pendingFromId ? rel.person2Id : rel.person1Id;
    const spouse = persons.find((p) => p._id === spouseId);
    if (!spouse) continue;
    const pendingName = `${pending.firstName} ${pending.lastName}`.trim();
    const spouseName = `${spouse.firstName} ${spouse.lastName}`.trim();
    if (pending.gender === "female") {
      options.push({ ids: [spouseId, pendingFromId], label: `${spouseName} and ${pendingName}` });
    } else {
      options.push({ ids: [pendingFromId, spouseId], label: `${pendingName} and ${spouseName}` });
    }
  }

  const pendingName = `${pending.firstName} ${pending.lastName}`.trim();
  const singleLabel =
    pending.gender === "female"
      ? `Unknown father and ${pendingName}`
      : `${pendingName} and Unknown mother`;
  options.push({ ids: [pendingFromId], label: singleLabel });

  return options;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors.

---

### Task 3: Add new state + update handleAddRelative in page.tsx

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

- [ ] **Step 1: Add two new state variables after the `pendingFromId` useState (line 104)**

After:
```ts
const [pendingFromId, setPendingFromId] = useState<string | null>(null);
```
add:
```ts
const [pendingCouplePartnerId, setPendingCouplePartnerId] = useState<string | null>(null);
const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
```

- [ ] **Step 2: Replace handleAddRelative (lines 146–149) with this version**

The new version accepts an optional third arg. For son/daughter from a PersonNode it seeds the default selection from `buildParentOptions`; for a CoupleNode (personId2 present) it skips options entirely.

```ts
const handleAddRelative = useCallback((personId: string, role: RelativeRole, personId2?: string) => {
  setPendingFromId(personId);
  setPendingRole(role);
  if (personId2) {
    setPendingCouplePartnerId(personId2);
    setSelectedParentIds([personId, personId2]);
  } else {
    setPendingCouplePartnerId(null);
    if (role === "son" || role === "daughter") {
      const opts = buildParentOptions(personId, persons, relationships);
      setSelectedParentIds(opts.length > 0 ? opts[0].ids : [personId]);
    } else {
      setSelectedParentIds([personId]);
    }
  }
}, [persons, relationships]);
```

- [ ] **Step 3: Add parentOptions useMemo after handleAddRelative**

```ts
const parentOptions = useMemo(() => {
  if (!pendingFromId || pendingCouplePartnerId) return [];
  return buildParentOptions(pendingFromId, persons, relationships);
}, [pendingFromId, pendingCouplePartnerId, persons, relationships]);
```

This drives the radio UI — separate from the seeding in `handleAddRelative` so the list stays reactive after dialog opens.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors.

---

### Task 4: Add Parents radio UI in dialog

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx` — inside `<DialogContent>`

- [ ] **Step 1: Insert radio group after `<PersonForm … />` and before the `{!pendingRole && …}` link block**

```tsx
{(pendingRole === "son" || pendingRole === "daughter") && !pendingCouplePartnerId && parentOptions.length > 0 && (
  <div className="border-t pt-4 space-y-3">
    <p className="text-sm font-medium">{t("parents")}</p>
    <div className="space-y-2">
      {parentOptions.map((opt) => {
        const key = opt.ids.join(",");
        const checked = selectedParentIds.join(",") === key;
        return (
          <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="parents"
              checked={checked}
              onChange={() => setSelectedParentIds(opt.ids)}
              className="accent-amber-500"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 2: Add "parents" translation key to all locale files**

Check which files exist:
```bash
ls messages/
```

For every file found (e.g. `messages/en.json`, `messages/he.json`), add `"parents": "Parents"` (translate appropriately) inside the `"tree"` namespace object.

- [ ] **Step 3: Verify dev server renders correctly**

```bash
npm run dev
```

Open the tree page. Click a person who has a spouse → "Add son". Confirm:
- Parents radio group appears below PersonForm
- Two options shown: couple option (pre-selected) + single-parent option
- Selecting the second option changes `selectedParentIds`

---

### Task 5: Update submitNewPerson to use selectedParentIds for son/daughter

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx` — inside `submitNewPerson`

- [ ] **Step 1: Split the else branch to handle son/daughter separately**

Current code at lines 198–205:
```ts
} else {
  const rel = roleToRelationship(pendingRole, pendingFromId, newPerson._id);
  await fetch(`/api/trees/${treeId}/relationships`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rel),
  });
}
```

Replace with:
```ts
} else if (pendingRole === "son" || pendingRole === "daughter") {
  for (const parentId of selectedParentIds) {
    await fetch(`/api/trees/${treeId}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "parent-child", person1Id: parentId, person2Id: newPerson._id }),
    });
  }
} else {
  const rel = roleToRelationship(pendingRole, pendingFromId, newPerson._id);
  await fetch(`/api/trees/${treeId}/relationships`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rel),
  });
}
```

---

### Task 6: Reset new state on dialog close

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx` — `onOpenChange` at line 394

- [ ] **Step 1: Add two new resets to the close handler**

Current:
```ts
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

Replace with:
```ts
onOpenChange={(o) => {
  if (!o) {
    setAddPersonOpen(false);
    setPendingRole(null);
    setPendingFromId(null);
    setPendingCouplePartnerId(null);
    setSelectedParentIds([]);
    setLinkToId("");
    setLinkRole("child-of");
  }
}}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors.

---

### Task 7: End-to-end manual verification + final commit

- [ ] **Scenario 1 — PersonNode with spouse, add son**
  1. Open tree where person A has spouse B.
  2. Click person A → "Add son".
  3. Confirm Parents section shows: "A and B" (pre-selected) + "A and Unknown mother" (adjust wording for gender).
  4. Leave couple option selected, fill name, submit.
  5. Confirm child appears below the A–B couple node on canvas (two parent-child edges created).

- [ ] **Scenario 2 — PersonNode no spouse, add daughter**
  1. Click person with no spouse → "Add daughter".
  2. Confirm Parents section shows one option (single-parent label).
  3. Submit. Confirm child linked to that person only.

- [ ] **Scenario 3 — CoupleNode, add son**
  1. Click empty space to deselect, click couple node → "Add son".
  2. Confirm dialog has NO Parents radio group.
  3. Submit. Confirm child linked to both couple members (two relationships created).

- [ ] **Scenario 4 — Other roles unaffected**
  1. Click any person → "Add father". Confirm no Parents section appears.
  2. Submit. Confirm single relationship created as before.

- [ ] **Final commit**

```bash
git add "app/(dashboard)/trees/[treeId]/page.tsx" components/tree/CoupleNode.tsx
git commit -m "feat: add parents selector when adding child to family tree"
```
