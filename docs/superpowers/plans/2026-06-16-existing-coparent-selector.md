# Existing Co-Parent Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "select existing person as co-parent" radio option to the Parents selector dialog so users can link a new child to any existing person in the tree, not just current spouses.

**Architecture:** All changes in one file (`page.tsx`). Extend `buildParentOptions` return type with an `isExistingPersonSlot` flag; add one new state var `existingCoParentId`; render the slot option with an inline `<Select>` dropdown; clear the new state everywhere existing state is cleared.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui `Select` (already imported in this file).

---

## File Map

| File | Change |
|------|--------|
| `app/(dashboard)/trees/[treeId]/page.tsx` | All changes — type, state, JSX, resets |

---

### Task 1: Extend buildParentOptions return type and append slot option

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx:79-116`

- [ ] **Step 1: Update the return type annotation and internal array type**

Find `buildParentOptions` (line 79). Change the return type and the internal `options` array declaration:

```ts
// Before (line 83)
): Array<{ ids: string[]; label: string }> {
// After
): Array<{ ids: string[]; label: string; isExistingPersonSlot?: boolean }> {
```

```ts
// Before (line 93)
  const options: Array<{ ids: string[]; label: string }> = [];
// After
  const options: Array<{ ids: string[]; label: string; isExistingPersonSlot?: boolean }> = [];
```

- [ ] **Step 2: Append the slot option before the return**

After the `options.push({ ids: [pendingFromId], label: singleLabel });` line (line 113), insert:

```ts
  options.push({ ids: [], label: "", isExistingPersonSlot: true });
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:\Users\User\Desktop\Genealogy" && npm run build 2>&1 | head -20
```

Expected: no new errors.

---

### Task 2: Add existingCoParentId state + update existing radio onChange

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

- [ ] **Step 1: Add new state variable after selectedParentIds (line 145)**

After:
```ts
const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
```
Insert:
```ts
const [existingCoParentId, setExistingCoParentId] = useState("");
```

- [ ] **Step 2: Update existing radio onChange to clear existingCoParentId**

In the Parents radio group JSX (around line 497), the existing `onChange` for non-slot options currently reads:
```ts
onChange={() => setSelectedParentIds(opt.ids)}
```

Change it to:
```ts
onChange={() => { setSelectedParentIds(opt.ids); setExistingCoParentId(""); }}
```

This ensures switching back to a spouse or single-parent radio deactivates the slot.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:\Users\User\Desktop\Genealogy" && npm run build 2>&1 | head -20
```

Expected: no new errors.

---

### Task 3: Render the slot radio option with inline Select dropdown

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx` — the Parents radio group JSX

- [ ] **Step 1: Replace the map rendering to handle slot option differently**

The current radio map (around lines 488–503):
```tsx
{parentOptions.map((opt) => {
  const key = opt.ids.join(",");
  const checked = selectedParentIds.join(",") === key;
  return (
    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="radio"
        name="parents"
        checked={checked}
        onChange={() => { setSelectedParentIds(opt.ids); setExistingCoParentId(""); }}
        className="accent-amber-500"
      />
      {opt.label}
    </label>
  );
})}
```

Replace with:
```tsx
{parentOptions.map((opt) => {
  if (opt.isExistingPersonSlot) {
    const pending = persons.find((p) => p._id === pendingFromId);
    const pendingName = pending ? `${pending.firstName} ${pending.lastName}`.trim() : "";
    const slotChecked = existingCoParentId !== "";
    return (
      <label key="existing-slot" className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="radio"
          name="parents"
          checked={slotChecked}
          disabled={existingCoParentId === ""}
          onChange={() => {}}
          className="accent-amber-500"
        />
        <span className="shrink-0">{pendingName} and</span>
        <Select
          value={existingCoParentId}
          onValueChange={(personId) => {
            if (!personId || !pendingFromId) return;
            setExistingCoParentId(personId);
            const ids =
              pending?.gender === "female"
                ? [personId, pendingFromId]
                : [pendingFromId, personId];
            setSelectedParentIds(ids);
          }}
        >
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue placeholder="Select person…" />
          </SelectTrigger>
          <SelectContent>
            {persons
              .filter((p) => p._id !== pendingFromId)
              .map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.firstName} {p.lastName}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </label>
    );
  }

  const key = opt.ids.join(",");
  const checked = selectedParentIds.join(",") === key;
  return (
    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="radio"
        name="parents"
        checked={checked}
        onChange={() => { setSelectedParentIds(opt.ids); setExistingCoParentId(""); }}
        className="accent-amber-500"
      />
      {opt.label}
    </label>
  );
})}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:\Users\User\Desktop\Genealogy" && npm run build 2>&1 | head -20
```

Expected: no new errors. The `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` components are already imported at the top of `page.tsx`.

- [ ] **Step 3: Verify dev server renders**

```bash
npm run dev
```

Open tree page, click a person → "Add son". Confirm:
- Three radio options: existing spouse(s), single-parent, and the new "PersonName and [Select person…]" row
- The Select dropdown lists all persons except the clicked one
- Picking a person from dropdown auto-checks the third radio and updates the selection
- Switching back to a spouse or single-parent radio unchecks the slot

---

### Task 4: Reset existingCoParentId everywhere state is cleared

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

- [ ] **Step 1: Add reset in the dialog onOpenChange handler**

Find the `onOpenChange` handler (around line 462). It currently resets:
```ts
setPendingCouplePartnerId(null);
setSelectedParentIds([]);
```

Add after `setSelectedParentIds([]);`:
```ts
setExistingCoParentId("");
```

- [ ] **Step 2: Add reset in submitNewPerson after successful submit**

Find the block inside `submitNewPerson` that resets state after the relationship is created (around line 272):
```ts
await mutateRels();
setPendingRole(null);
setPendingFromId(null);
setPendingCouplePartnerId(null);
setSelectedParentIds([]);
```

Add after `setSelectedParentIds([]);`:
```ts
setExistingCoParentId("");
```

- [ ] **Step 3: Final build check**

```bash
cd "c:\Users\User\Desktop\Genealogy" && npm run build 2>&1 | tail -15
```

Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
cd "c:\Users\User\Desktop\Genealogy"
git add "app/(dashboard)/trees/[treeId]/page.tsx"
git commit -m "feat: add existing person co-parent selector when adding child"
```

---

### Task 5: End-to-end manual verification

- [ ] **Scenario 1 — Pick existing person as co-parent (no spouse)**
  1. Have tree with persons A (male) and B (female), no spouse link between them.
  2. Click A → "Add son".
  3. Parents section shows: "A and Unknown mother" + "A and [Select person…]".
  4. Pick B from dropdown. Third radio auto-checks. "A and B" effectively selected.
  5. Fill son's name, submit.
  6. Confirm two `parent-child` rels created: A→son and B→son.
  7. Tree canvas shows son below A-B (they appear as couple if `buildTreeData` detects both as parents).

- [ ] **Scenario 2 — Person with existing spouse, pick different co-parent**
  1. A has spouse C. A also has no relation to D.
  2. Click A → "Add daughter".
  3. Three options shown: "A and C", "A and Unknown mother", "A and [Select…]".
  4. Pick D from dropdown. "A and D" radio checks.
  5. Submit. Two rels created: A→daughter and D→daughter. No A-D spouse rel created.

- [ ] **Scenario 3 — Switch radio after picking from dropdown**
  1. Click A → "Add son". Pick D from dropdown (slot checked).
  2. Click "A and Unknown mother" radio.
  3. Confirm slot radio unchecks. Single-parent option is now active.
  4. Submit. Only one `parent-child` rel created: A→son.

- [ ] **Scenario 4 — Dialog close resets state**
  1. Pick someone from dropdown.
  2. Close dialog without submitting.
  3. Reopen "Add son". Confirm dropdown is empty, slot radio is unchecked.
