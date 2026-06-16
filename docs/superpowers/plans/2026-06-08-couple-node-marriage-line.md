# CoupleNode Marriage Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `CoupleNode` from a single combined card to two separate PersonCard boxes connected by an amber ♥ marriage line, while keeping it a single React Flow node.

**Architecture:** `CoupleNode.tsx` gets two internal components — `PersonCard` (identical style to `PersonNode` card, no handles) and `MarriageLine` (60px flex row with amber lines and ♥). The outer `CoupleNode` wrapper keeps its React Flow `Handle` elements centered. `treeLayout.ts` gets `COUPLE_W` bumped from 200 → 380 so dagre reserves enough horizontal room.

**Tech Stack:** React 19, React Flow (`@xyflow/react`), Tailwind CSS v4, shadcn/ui `Avatar`.

---

### Task 1: Update layout constant

**Files:**
- Modify: `lib/treeLayout.ts:3`

- [ ] **Step 1: Change COUPLE_W**

Open `lib/treeLayout.ts` and change line 4:

```ts
// before
const COUPLE_W = 200;

// after
const COUPLE_W = 380;  // 160px card + 60px gap + 160px card
```

No other changes in this file — all three `COUPLE_W` references (node registration at line 23, sibling width at line 65, position conversion at line 82) pick up the new value automatically.

- [ ] **Step 2: Commit**

```bash
git add lib/treeLayout.ts
git commit -m "feat: widen couple node layout width to 380px for two-card design"
```

---

### Task 2: Restyle CoupleNode

**Files:**
- Modify: `components/tree/CoupleNode.tsx` (full replacement)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `components/tree/CoupleNode.tsx` with:

```tsx
"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { IPerson, RelativeRole } from "@/types";

export type CoupleNodeType = Node<
  {
    person1: IPerson;
    person2: IPerson;
    onAddRelative?: (personId: string, role: RelativeRole) => void;
    onSelect?: (person: IPerson) => void;
  },
  "coupleNode"
>;

const genderBorder: Record<string, string> = {
  male:    "border-blue-300",
  female:  "border-pink-300",
  other:   "border-purple-300",
  unknown: "border-gray-200",
};

const genderSelectedBorder: Record<string, string> = {
  male:    "border-blue-500",
  female:  "border-pink-500",
  other:   "border-purple-500",
  unknown: "border-amber-500",
};

const genderAvatar: Record<string, string> = {
  male:    "bg-blue-50 text-blue-700",
  female:  "bg-pink-50 text-pink-700",
  other:   "bg-purple-50 text-purple-700",
  unknown: "bg-gray-50 text-gray-600",
};

function PersonCard({
  person,
  selected,
  onClick,
}: {
  person: IPerson;
  selected: boolean;
  onClick: () => void;
}) {
  const initials = `${person.firstName[0] ?? "?"}${person.lastName[0] ?? ""}`;
  const gender = person.gender ?? "unknown";

  return (
    <div
      className={`bg-white border-2 rounded-xl shadow-sm w-40 cursor-pointer select-none transition-all ${
        selected
          ? `${genderSelectedBorder[gender]} shadow-md`
          : `${genderBorder[gender]} hover:shadow-md`
      }`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div className={`h-1 rounded-t-xl ${person.isLiving ? "bg-green-400" : "bg-gray-300"}`} />
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <Avatar className="h-11 w-11">
            <AvatarImage src={person.photoUrl} />
            <AvatarFallback className={`text-sm font-semibold ${genderAvatar[gender]}`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
              person.isLiving ? "bg-green-400" : "bg-gray-400"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs leading-tight truncate">{person.firstName}</p>
          <p className="text-xs text-gray-600 leading-tight truncate">{person.lastName}</p>
          {(person.birthDate || person.deathDate) && (
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5 truncate">
              {person.birthDate ?? "?"}
              {!person.isLiving && person.deathDate ? `–${person.deathDate}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MarriageLine() {
  return (
    <div className="flex items-center w-[60px] flex-shrink-0">
      <div className="flex-1 h-[1.5px] bg-amber-400" />
      <span className="text-amber-500 text-sm mx-1 leading-none select-none">♥</span>
      <div className="flex-1 h-[1.5px] bg-amber-400" />
    </div>
  );
}

const CHILD_BUTTONS: { role: RelativeRole; label: string }[] = [
  { role: "son",      label: "Add son" },
  { role: "daughter", label: "Add daughter" },
];

export function CoupleNode({ data, selected }: NodeProps<CoupleNodeType>) {
  const { person1, person2, onAddRelative, onSelect } = data;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />

      {selected && onAddRelative && (
        <>
          <button
            className="nodrag nopan absolute -top-9 left-0 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, "father"); }}
          >
            <span className="text-amber-500 font-bold">+</span> Add father
          </button>
          <button
            className="nodrag nopan absolute -top-9 right-0 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, "mother"); }}
          >
            <span className="text-amber-500 font-bold">+</span> Add mother
          </button>
        </>
      )}

      <div className="flex items-center">
        <PersonCard
          person={person1}
          selected={selected}
          onClick={() => onSelect?.(person1)}
        />
        <MarriageLine />
        <PersonCard
          person={person2}
          selected={selected}
          onClick={() => onSelect?.(person2)}
        />
      </div>

      {selected && onAddRelative && (
        <div className="absolute -bottom-9 left-0 right-0 flex justify-center gap-2 z-10">
          {CHILD_BUTTONS.map(({ role, label }) => (
            <button
              key={role}
              className="nodrag nopan flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
              onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, role); }}
            >
              <span className="text-amber-500 font-bold">+</span> {label}
            </button>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If errors appear, fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add components/tree/CoupleNode.tsx
git commit -m "feat: restyle CoupleNode as two separate cards with amber heart marriage line"
```

---

### Task 3: Visual verification

**Files:** none — read-only verification step.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3000`, navigate to a tree that has at least one married couple.

- [ ] **Step 2: Check couple rendering**

Verify:
- Married couple shows as **two separate cards** (blue border for male, pink border for female) with a horizontal amber line and ♥ between them.
- **No** single combined box with a divider.
- Cards match `PersonNode` style: avatar, living dot, name, dates.

- [ ] **Step 3: Check handles**

Click on empty canvas to deselect. Then click the couple node. Verify:
- Top handle (for parent edges) appears centered above the gap between the two cards.
- Bottom handle (for child edges) appears centered below.
- Child edges drop from the center bottom, not from one card only.

- [ ] **Step 4: Check add buttons**

With couple node selected, verify:
- "Add father" button appears above the **left** card.
- "Add mother" button appears above the **right** card.
- "Add son" / "Add daughter" buttons appear centered below.

- [ ] **Step 5: Check adjacent node spacing**

If the tree has siblings or nearby nodes, verify no overlap. Dagre should give the couple node 380px horizontal room — adjacent nodes should not crowd in.

- [ ] **Step 6: Commit if any tweaks were needed**

If you made any visual tweaks during verification:

```bash
git add components/tree/CoupleNode.tsx
git commit -m "fix: adjust couple node spacing/alignment after visual review"
```

If no tweaks needed, skip this step.
