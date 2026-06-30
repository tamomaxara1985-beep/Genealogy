# Sibling Auto-Link & Unlink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-derive and display siblings in each person's profile, with a non-destructive, mutual, reversible "unlink".

**Architecture:** Siblings are derived from shared parents (no sibling rows). A new `SiblingHide` collection stores per-pair suppression. A pure util derives sibling ids and splits them into visible/hidden using the hide rows. The profile renders a Siblings section + a Hidden siblings subsection. Spouse-link, unlink, and divorce already exist and are untouched.

**Tech Stack:** Next.js 16 App Router, Mongoose 9, SWR, React 19, TypeScript. Vitest (new) for the one pure util.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/types`.
- Mongoose models use hot-reload guard: `models.X ?? model("X", Schema)`.
- API handlers: `await auth()` → 401 if no session. Writes check ownership via `Tree.findOne({ _id: treeId, ownerId: session.user.id })`. Reads use `resolveTreeAccess(treeId, session)`.
- DTO types live in `types/index.ts` (single source of truth).
- Profile relationship UI uses **hardcoded English strings** (match existing Parents/Spouses/Children sections — no i18n keys).
- Amber color scheme; reuse existing unlink button classes verbatim.

---

### Task 1: Sibling derivation util (pure, TDD with Vitest)

**Files:**
- Modify: `package.json` (add `vitest` devDep + `test` script)
- Create: `vitest.config.ts`
- Create: `types/index.ts` addition — `ISiblingHide` interface
- Create: `lib/deriveSiblings.ts`
- Test: `lib/deriveSiblings.test.ts`

**Interfaces:**
- Consumes: `IRelationship` (existing, `types/index.ts`), `ISiblingHide` (defined this task).
- Produces:
  - `normalizePair(a: string, b: string): [string, string]` — sorted pair.
  - `deriveSiblingIds(personId: string, relationships: IRelationship[]): string[]` — distinct ids sharing ≥1 parent with `personId`, excluding `personId`.
  - `splitSiblingsByHide(personId: string, siblingIds: string[], hides: ISiblingHide[]): { visible: string[]; hidden: { siblingId: string; hideId: string }[] }`.

- [ ] **Step 1: Add `ISiblingHide` to `types/index.ts`**

Append after the `IRelationship` interface (around line 63):

```ts
export interface ISiblingHide {
  _id: string
  treeId: string
  personAId: string
  personBId: string
}
```

- [ ] **Step 2: Add Vitest tooling**

Add to `package.json` `devDependencies`:

```json
"vitest": "^3.2.4"
```

Add to `package.json` `scripts`:

```json
"test": "vitest run"
```

Run: `npm install`
Expected: vitest added to `node_modules`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Write the failing test**

Create `lib/deriveSiblings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizePair, deriveSiblingIds, splitSiblingsByHide } from "./deriveSiblings";
import type { IRelationship, ISiblingHide } from "@/types";

const rel = (
  type: IRelationship["type"],
  person1Id: string,
  person2Id: string
): IRelationship => ({ _id: `${type}-${person1Id}-${person2Id}`, treeId: "t1", type, person1Id, person2Id });

describe("normalizePair", () => {
  it("sorts the pair lexicographically", () => {
    expect(normalizePair("b", "a")).toEqual(["a", "b"]);
    expect(normalizePair("a", "b")).toEqual(["a", "b"]);
  });
});

describe("deriveSiblingIds", () => {
  it("returns people who share a parent, excluding self", () => {
    const rels = [
      rel("parent-child", "dad", "kid1"),
      rel("parent-child", "dad", "kid2"),
      rel("parent-child", "dad", "kid3"),
    ];
    expect(deriveSiblingIds("kid1", rels).sort()).toEqual(["kid2", "kid3"]);
  });

  it("dedups a sibling shared via two parents", () => {
    const rels = [
      rel("parent-child", "dad", "kid1"),
      rel("parent-child", "dad", "kid2"),
      rel("parent-child", "mom", "kid1"),
      rel("parent-child", "mom", "kid2"),
    ];
    expect(deriveSiblingIds("kid1", rels)).toEqual(["kid2"]);
  });

  it("ignores spouse rels and returns empty when no shared parent", () => {
    const rels = [
      rel("parent-child", "dad", "kid1"),
      rel("spouse", "kid1", "someone"),
    ];
    expect(deriveSiblingIds("kid1", rels)).toEqual([]);
  });
});

describe("splitSiblingsByHide", () => {
  const hide = (a: string, b: string): ISiblingHide => {
    const [personAId, personBId] = [a, b].sort();
    return { _id: `h-${personAId}-${personBId}`, treeId: "t1", personAId, personBId };
  };

  it("moves hidden pairs out of visible, regardless of stored order", () => {
    const result = splitSiblingsByHide("kid1", ["kid2", "kid3"], [hide("kid3", "kid1")]);
    expect(result.visible).toEqual(["kid2"]);
    expect(result.hidden).toEqual([{ siblingId: "kid3", hideId: "h-kid1-kid3" }]);
  });

  it("keeps all visible when no hides match", () => {
    const result = splitSiblingsByHide("kid1", ["kid2"], [hide("x", "y")]);
    expect(result.visible).toEqual(["kid2"]);
    expect(result.hidden).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./deriveSiblings` (module not found).

- [ ] **Step 5: Write the implementation**

Create `lib/deriveSiblings.ts`:

```ts
import type { IRelationship, ISiblingHide } from "@/types";

export function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function deriveSiblingIds(
  personId: string,
  relationships: IRelationship[]
): string[] {
  const parentChild = relationships.filter((r) => r.type === "parent-child");
  const parentIds = new Set(
    parentChild.filter((r) => r.person2Id === personId).map((r) => r.person1Id)
  );
  const siblings = new Set<string>();
  for (const r of parentChild) {
    if (parentIds.has(r.person1Id) && r.person2Id !== personId) {
      siblings.add(r.person2Id);
    }
  }
  return [...siblings];
}

export function splitSiblingsByHide(
  personId: string,
  siblingIds: string[],
  hides: ISiblingHide[]
): { visible: string[]; hidden: { siblingId: string; hideId: string }[] } {
  const hideByPair = new Map<string, string>();
  for (const h of hides) {
    const [a, b] = normalizePair(h.personAId, h.personBId);
    hideByPair.set(`${a}|${b}`, h._id);
  }
  const visible: string[] = [];
  const hidden: { siblingId: string; hideId: string }[] = [];
  for (const sib of siblingIds) {
    const [a, b] = normalizePair(personId, sib);
    const hideId = hideByPair.get(`${a}|${b}`);
    if (hideId) hidden.push({ siblingId: sib, hideId });
    else visible.push(sib);
  }
  return { visible, hidden };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `lib/deriveSiblings.test.ts` green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts types/index.ts lib/deriveSiblings.ts lib/deriveSiblings.test.ts
git commit -m "feat: sibling derivation util + ISiblingHide type"
```

---

### Task 2: `SiblingHide` Mongoose model

**Files:**
- Create: `lib/models/SiblingHide.ts`

**Interfaces:**
- Produces: default-exported Mongoose model `SiblingHide` with fields `treeId`, `personAId`, `personBId` (all ObjectId), `timestamps: true`, unique compound index `{ treeId, personAId, personBId }`.

- [ ] **Step 1: Write the model**

Create `lib/models/SiblingHide.ts`:

```ts
import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ISiblingHideDoc extends Document {
  treeId: mongoose.Types.ObjectId;
  personAId: mongoose.Types.ObjectId;
  personBId: mongoose.Types.ObjectId;
}

const SiblingHideSchema = new Schema<ISiblingHideDoc>(
  {
    treeId: { type: Schema.Types.ObjectId, ref: "Tree", required: true },
    personAId: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    personBId: { type: Schema.Types.ObjectId, ref: "Person", required: true },
  },
  { timestamps: true }
);

SiblingHideSchema.index(
  { treeId: 1, personAId: 1, personBId: 1 },
  { unique: true }
);

export default models.SiblingHide ??
  model<ISiblingHideDoc>("SiblingHide", SiblingHideSchema);
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors from `lib/models/SiblingHide.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/models/SiblingHide.ts
git commit -m "feat: SiblingHide model"
```

---

### Task 3: Sibling-hides API routes

**Files:**
- Create: `app/api/trees/[treeId]/sibling-hides/route.ts` (GET, POST)
- Create: `app/api/trees/[treeId]/sibling-hides/[hideId]/route.ts` (DELETE)

**Interfaces:**
- Consumes: `SiblingHide` model (Task 2), `normalizePair` (Task 1), `resolveTreeAccess` (existing `lib/treeAccess.ts`), `auth` (`lib/auth.ts`), `connectDB` (`lib/db.ts`), `Tree` model.
- Produces:
  - `GET /api/trees/[treeId]/sibling-hides` → `ISiblingHide[]`.
  - `POST /api/trees/[treeId]/sibling-hides` body `{ personAId, personBId }` → created hide (201).
  - `DELETE /api/trees/[treeId]/sibling-hides/[hideId]` → `{ ok: true }`.

- [ ] **Step 1: Write the GET + POST route**

Create `app/api/trees/[treeId]/sibling-hides/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import SiblingHide from "@/lib/models/SiblingHide";
import { resolveTreeAccess } from "@/lib/treeAccess";
import { normalizePair } from "@/lib/deriveSiblings";

type Params = { params: Promise<{ treeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const { tree, role } = await resolveTreeAccess(treeId, session);
  if (!tree || !role)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const hides = await SiblingHide.find({ treeId });
  return NextResponse.json(hides);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const { personAId, personBId } = await req.json();
  if (!personAId || !personBId)
    return NextResponse.json(
      { error: "personAId, personBId required" },
      { status: 400 }
    );

  const [a, b] = normalizePair(personAId, personBId);
  const hide = await SiblingHide.findOneAndUpdate(
    { treeId, personAId: a, personBId: b },
    { $setOnInsert: { treeId, personAId: a, personBId: b } },
    { new: true, upsert: true }
  );
  return NextResponse.json(hide, { status: 201 });
}
```

- [ ] **Step 2: Write the DELETE route**

Create `app/api/trees/[treeId]/sibling-hides/[hideId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import SiblingHide from "@/lib/models/SiblingHide";

type Params = { params: Promise<{ treeId: string; hideId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId, hideId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const hide = await SiblingHide.findOneAndDelete({ _id: hideId, treeId });
  if (!hide)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify the endpoints**

Run: `npm run dev`, then with a logged-in session and a real `treeId` + two `personId`s:
- `POST /api/trees/<treeId>/sibling-hides` with `{ "personAId": "...", "personBId": "..." }` → 201, returns a hide doc with normalized `personAId < personBId`.
- `GET /api/trees/<treeId>/sibling-hides` → array including that hide.
- POST the same pair again → still 201, no duplicate (GET count unchanged).
- `DELETE /api/trees/<treeId>/sibling-hides/<hideId>` → `{ ok: true }`; GET no longer lists it.

- [ ] **Step 5: Commit**

```bash
git add "app/api/trees/[treeId]/sibling-hides"
git commit -m "feat: sibling-hides API (list/create/delete)"
```

---

### Task 4: Profile Siblings + Hidden siblings UI

**Files:**
- Modify: `app/(dashboard)/person/[personId]/page.tsx`

**Interfaces:**
- Consumes: `deriveSiblingIds`, `splitSiblingsByHide` (Task 1); sibling-hides API (Task 3); existing `PersonLink`, SWR `fetcher`, `mutateRels` patterns.

- [ ] **Step 1: Import the util**

Add near the top imports (after the `types` import, ~line 17):

```ts
import { deriveSiblingIds, splitSiblingsByHide } from "@/lib/deriveSiblings";
import type { ISiblingHide } from "@/types";
```

- [ ] **Step 2: Fetch sibling-hides via SWR**

After the `allRels` SWR hook (~line 67), add:

```ts
const { data: siblingHides = [], mutate: mutateHides } = useSWR<ISiblingHide[]>(
  person ? `/api/trees/${person.treeId}/sibling-hides` : null,
  fetcher
);
```

- [ ] **Step 3: Derive visible + hidden siblings**

After the existing relationship-derivation block (after `spouses`, ~line 102), add:

```ts
const allSiblingIds = deriveSiblingIds(personId, allRels);
const { visible: siblingIds, hidden: hiddenSiblings } = splitSiblingsByHide(
  personId,
  allSiblingIds,
  siblingHides
);
```

Update `hasRelationships` (line 103) to include visible siblings:

```ts
const hasRelationships =
  parents.length + children.length + spouses.length + siblingIds.length > 0;
```

- [ ] **Step 4: Add the unlink/relink handlers**

After `handleUnlink` (~line 138), add:

```ts
async function handleUnlinkSibling(siblingId: string) {
  await fetch(`/api/trees/${person!.treeId}/sibling-hides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personAId: personId, personBId: siblingId }),
  });
  await mutateHides();
}

async function handleRelinkSibling(hideId: string) {
  await fetch(`/api/trees/${person!.treeId}/sibling-hides/${hideId}`, {
    method: "DELETE",
  });
  await mutateHides();
}
```

- [ ] **Step 5: Render the Siblings section**

Insert immediately after the Parents block's closing `)}` (after ~line 247, before the Spouses block):

```tsx
{siblingIds.length > 0 && (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
      Siblings
    </p>
    <div className="space-y-1">
      {siblingIds.map((sibId) => (
        <div key={sibId} className="flex items-center justify-between">
          <PersonLink id={sibId} />
          {isOwner && (
            <button
              className="text-[11px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded border border-gray-200 hover:border-red-300 transition-colors"
              onClick={() => handleUnlinkSibling(sibId)}
            >
              unlink
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
)}

{isOwner && hiddenSiblings.length > 0 && (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1.5">
      Hidden siblings
    </p>
    <div className="space-y-1">
      {hiddenSiblings.map(({ siblingId, hideId }) => (
        <div key={hideId} className="flex items-center justify-between opacity-60">
          <PersonLink id={siblingId} />
          <button
            className="text-[11px] text-gray-400 hover:text-amber-600 px-1.5 py-0.5 rounded border border-gray-200 hover:border-amber-300 transition-colors"
            onClick={() => handleRelinkSibling(hideId)}
          >
            relink
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 6: Verify it compiles + lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Manual end-to-end verification**

Run: `npm run dev`. With a tree where two people share a parent:
- Open each sibling's profile → both list the other under **Siblings** automatically.
- On one profile, click **unlink** on the sibling → it disappears from Siblings and appears under **Hidden siblings**.
- Open the other sibling's profile → the pairing is gone there too (mutual).
- Click **relink** under Hidden siblings → sibling returns on both profiles.
- Confirm the family tree canvas is unchanged (siblings still cluster).
- Confirm Spouses still link, the **unlink** on spouses/parents/children still works, and the **divorce** dialog still sets the `div.` badge.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/person/[personId]/page.tsx"
git commit -m "feat: auto-derived Siblings section with non-destructive unlink/relink"
```

---

## Self-review notes

- **Spec coverage:** siblings auto-display (Task 4 Step 5) ✓; mutual unlink via normalized pair (Task 1 + Task 3 POST) ✓; reversible relink (Task 3 DELETE + Task 4 relink) ✓; profile-list-only / tree untouched (no tree task) ✓; spouse-link/unlink/divorce preserved (untouched, verified Task 4 Step 7) ✓.
- **Deviation from spec:** spec's i18n section dropped — existing profile relationship UI uses hardcoded English, so new sections match that pattern (Global Constraints). No `messages/*.json` changes.
- **Type consistency:** `ISiblingHide` fields (`_id`, `treeId`, `personAId`, `personBId`) consistent across types, model, API, util, and UI. `normalizePair` used identically in util and API POST.
