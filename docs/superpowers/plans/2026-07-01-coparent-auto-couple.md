# Co-Parent Auto-Couple + Couple Gender Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render two parents of the same child as a real couple (persisted spouse link, divorce/unlink via profile), and order every couple card female-left / male-right.

**Architecture:** A pure helper finds co-parent pairs lacking a spouse rel. A one-time per-tree backfill endpoint creates those spouse rels for existing data; the `POST /relationships` handler creates them going forward (scoped to the affected child). `buildTreeData` orders couple slots by a gender rank.

**Tech Stack:** Next.js 16 App Router, Mongoose 9, SWR, React 19, TypeScript, Vitest.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/types`.
- Mongoose models use hot-reload guard: `models.X ?? model("X", Schema)`.
- API handlers: `await auth()` → 401 `{ error: "Unauthorized" }` if no session. Writes check ownership via `Tree.findOne({ _id: treeId, ownerId: session.user.id })` → 404 if not found. Route params are `Promise<{...}>`, awaited.
- Mongoose ObjectId fields must be `String(...)`-converted before passing to the string-based helpers.
- A child qualifies for auto-couple only with **exactly 2** distinct parents and **no** spouse rel between them (any `endDate`).
- `CoupleNode` renders `person1` on the LEFT, `person2` on the RIGHT. Desired: female left, male right.
- DTO types live in `types/index.ts`.

---

### Task 1: Co-parent pair helper (pure, TDD)

**Files:**
- Create: `lib/coParentCouple.ts`
- Test: `lib/coParentCouple.test.ts`

**Interfaces:**
- Consumes: `IRelationship` (`types/index.ts`).
- Produces:
  - `coParentPairForChild(childId: string, relationships: IRelationship[]): [string, string] | null`
  - `coParentPairsNeedingSpouse(relationships: IRelationship[]): Array<[string, string]>`

- [ ] **Step 1: Write the failing test**

Create `lib/coParentCouple.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { coParentPairForChild, coParentPairsNeedingSpouse } from "./coParentCouple";
import type { IRelationship } from "@/types";

const r = (type: IRelationship["type"], a: string, b: string, endDate?: string): IRelationship =>
  ({ _id: `${type}-${a}-${b}`, treeId: "t", type, person1Id: a, person2Id: b, endDate });

describe("coParentPairForChild", () => {
  it("returns the normalized pair for a child with exactly 2 parents and no spouse rel", () => {
    const rels = [r("parent-child", "dad", "kid"), r("parent-child", "mom", "kid")];
    expect(coParentPairForChild("kid", rels)).toEqual(["dad", "mom"]);
  });

  it("returns null when a spouse rel already exists (even divorced)", () => {
    const rels = [
      r("parent-child", "dad", "kid"),
      r("parent-child", "mom", "kid"),
      r("spouse", "mom", "dad", "1990"),
    ];
    expect(coParentPairForChild("kid", rels)).toBeNull();
  });

  it("returns null for 1 parent and for 3+ parents", () => {
    expect(coParentPairForChild("kid", [r("parent-child", "dad", "kid")])).toBeNull();
    const three = [
      r("parent-child", "dad", "kid"),
      r("parent-child", "mom", "kid"),
      r("parent-child", "step", "kid"),
    ];
    expect(coParentPairForChild("kid", three)).toBeNull();
  });
});

describe("coParentPairsNeedingSpouse", () => {
  it("dedups a pair that co-parents multiple children", () => {
    const rels = [
      r("parent-child", "dad", "kid1"), r("parent-child", "mom", "kid1"),
      r("parent-child", "dad", "kid2"), r("parent-child", "mom", "kid2"),
    ];
    expect(coParentPairsNeedingSpouse(rels)).toEqual([["dad", "mom"]]);
  });

  it("skips pairs that already have a spouse rel; includes those that don't", () => {
    const rels = [
      r("parent-child", "dad", "kid1"), r("parent-child", "mom", "kid1"),
      r("spouse", "dad", "mom"),
      r("parent-child", "a", "kid2"), r("parent-child", "b", "kid2"),
    ];
    expect(coParentPairsNeedingSpouse(rels)).toEqual([["a", "b"]]);
  });

  it("returns empty when there are no qualifying children", () => {
    expect(coParentPairsNeedingSpouse([r("parent-child", "dad", "kid")])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/coParentCouple.test.ts`
Expected: FAIL — cannot resolve `./coParentCouple`.

- [ ] **Step 3: Write the implementation**

Create `lib/coParentCouple.ts`:

```ts
import type { IRelationship } from "@/types";

function parentsByChild(rels: IRelationship[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rels) {
    if (r.type !== "parent-child") continue;
    const arr = m.get(r.person2Id) ?? [];
    if (!arr.includes(r.person1Id)) arr.push(r.person1Id);
    m.set(r.person2Id, arr);
  }
  return m;
}

function hasSpouseBetween(a: string, b: string, rels: IRelationship[]): boolean {
  return rels.some(
    (r) =>
      r.type === "spouse" &&
      ((r.person1Id === a && r.person2Id === b) ||
        (r.person1Id === b && r.person2Id === a))
  );
}

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function coParentPairForChild(
  childId: string,
  relationships: IRelationship[]
): [string, string] | null {
  const parents = parentsByChild(relationships).get(childId) ?? [];
  if (parents.length !== 2) return null;
  const [a, b] = parents;
  if (hasSpouseBetween(a, b, relationships)) return null;
  return normalizePair(a, b);
}

export function coParentPairsNeedingSpouse(
  relationships: IRelationship[]
): Array<[string, string]> {
  const map = parentsByChild(relationships);
  const seen = new Set<string>();
  const pairs: Array<[string, string]> = [];
  for (const parents of map.values()) {
    if (parents.length !== 2) continue;
    const [a, b] = normalizePair(parents[0], parents[1]);
    if (hasSpouseBetween(a, b, relationships)) continue;
    const key = `${a}|${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([a, b]);
  }
  return pairs;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/coParentCouple.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/coParentCouple.ts lib/coParentCouple.test.ts
git commit -m "feat: co-parent pair helper (find parents needing a spouse link)"
```

---

### Task 2: Couple gender ordering (female left, male right)

**Files:**
- Modify: `lib/buildTreeData.ts` (the regular-couple swap, currently near line 162)
- Test: `lib/buildTreeData.ordering.test.ts`

**Interfaces:**
- Consumes: `buildTreeData(persons, relationships, callbacks, highlighted)` (existing).

- [ ] **Step 1: Write the failing test**

Create `lib/buildTreeData.ordering.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTreeData } from "./buildTreeData";
import type { IPerson, IRelationship } from "@/types";

const p = (id: string, gender: IPerson["gender"]): IPerson =>
  ({ _id: id, treeId: "t", firstName: id, lastName: "X", gender, isLiving: true,
     createdAt: new Date(), updatedAt: new Date() } as IPerson);

const spouse = (a: string, b: string): IRelationship =>
  ({ _id: `s-${a}-${b}`, treeId: "t", type: "spouse", person1Id: a, person2Id: b });

function coupleOf(persons: IPerson[], a: string, b: string) {
  const { nodes } = buildTreeData(persons, [spouse(a, b)], { onSelect: () => {} }, new Set());
  const c = nodes.find((n) => n.type === "coupleNode");
  if (!c) throw new Error("no couple node");
  const data = c.data as { person1: IPerson; person2: IPerson };
  return { left: data.person1.gender, right: data.person2.gender };
}

describe("buildTreeData couple ordering — female left, male right", () => {
  it("female-first stays female-left/male-right", () => {
    expect(coupleOf([p("f", "female"), p("m", "male")], "f", "m")).toEqual({ left: "female", right: "male" });
  });
  it("male-first is swapped to female-left/male-right", () => {
    expect(coupleOf([p("m", "male"), p("f", "female")], "m", "f")).toEqual({ left: "female", right: "male" });
  });
  it("unknown + male puts male on the right", () => {
    expect(coupleOf([p("m", "male"), p("u", "unknown")], "m", "u")).toEqual({ left: "unknown", right: "male" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/buildTreeData.ordering.test.ts`
Expected: FAIL — the male-first and unknown+male cases come back in the wrong order (current swap only handles `male,female`).

- [ ] **Step 3: Implement the ordering change**

In `lib/buildTreeData.ts`, find the regular-couple construction line:

```ts
      if (p1.gender === "male" && p2.gender === "female") [p1, p2] = [p2, p1];
```

Replace it with:

```ts
      const slotRank = (g: IPerson["gender"]) =>
        g === "female" ? 0 : g === "male" ? 2 : 1;
      if (slotRank(p1.gender) > slotRank(p2.gender)) [p1, p2] = [p2, p1];
```

(Leave the poly-couple node ordering untouched — out of scope.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/buildTreeData.ordering.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all test files pass; no new type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/buildTreeData.ts lib/buildTreeData.ordering.test.ts
git commit -m "feat: order couple cards female-left / male-right"
```

---

### Task 3: Tree backfill flag + ITree DTO

**Files:**
- Modify: `lib/models/Tree.ts`
- Modify: `types/index.ts`

**Interfaces:**
- Produces: `ITreeDoc.coParentBackfillAt?: Date` (schema field), `ITree.coParentBackfillAt?: string` (DTO).

- [ ] **Step 1: Add the schema field**

In `lib/models/Tree.ts`, add to `ITreeDoc` interface (after `sharedEmails`):

```ts
  coParentBackfillAt?: Date;
```

And to the schema definition (after `sharedEmails`):

```ts
    coParentBackfillAt: { type: Date },
```

- [ ] **Step 2: Add the DTO field**

In `types/index.ts`, add to the `ITree` interface (after `sharedEmails?`):

```ts
  coParentBackfillAt?: string
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/models/Tree.ts types/index.ts
git commit -m "feat: add coParentBackfillAt flag to Tree"
```

---

### Task 4: Backfill endpoint — reconcile-couples

**Files:**
- Create: `app/api/trees/[treeId]/reconcile-couples/route.ts`

**Interfaces:**
- Consumes: `coParentPairsNeedingSpouse` (Task 1), `Tree`, `Relationship`, `auth`, `connectDB`, `coParentBackfillAt` (Task 3).
- Produces: `POST /api/trees/[treeId]/reconcile-couples` → `{ created: number, alreadyDone?: boolean }`.

- [ ] **Step 1: Write the route**

Create `app/api/trees/[treeId]/reconcile-couples/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import Relationship from "@/lib/models/Relationship";
import { coParentPairsNeedingSpouse } from "@/lib/coParentCouple";
import type { IRelationship } from "@/types";

type Params = { params: Promise<{ treeId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (tree.coParentBackfillAt)
    return NextResponse.json({ created: 0, alreadyDone: true });

  const docs = await Relationship.find({ treeId }).lean();
  const rels = docs.map((d) => ({
    _id: String(d._id),
    treeId: String(d.treeId),
    type: d.type,
    person1Id: String(d.person1Id),
    person2Id: String(d.person2Id),
    endDate: d.endDate,
  })) as IRelationship[];

  const pairs = coParentPairsNeedingSpouse(rels);
  if (pairs.length > 0) {
    await Relationship.insertMany(
      pairs.map(([person1Id, person2Id]) => ({
        treeId,
        type: "spouse",
        person1Id,
        person2Id,
      }))
    );
  }

  tree.coParentBackfillAt = new Date();
  await tree.save();

  return NextResponse.json({ created: pairs.length });
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke (deferred — interactive)**

Live test requires an authenticated owner session, so it is deferred to the controller/user. Statically confirm: 401 without session, 404 for non-owner, flag-guard returns `alreadyDone` on second call, and `insertMany` only runs for pairs returned by the helper.

- [ ] **Step 4: Commit**

```bash
git add "app/api/trees/[treeId]/reconcile-couples"
git commit -m "feat: one-time co-parent spouse backfill endpoint"
```

---

### Task 5: Going-forward auto-couple in relationships POST

**Files:**
- Modify: `app/api/trees/[treeId]/relationships/route.ts` (POST handler)

**Interfaces:**
- Consumes: `coParentPairForChild` (Task 1), existing `Relationship`, `connectDB`, `auth`, `Tree`.

- [ ] **Step 1: Add the import**

At the top of `app/api/trees/[treeId]/relationships/route.ts`, add:

```ts
import { coParentPairForChild } from "@/lib/coParentCouple";
import type { IRelationship } from "@/types";
```

- [ ] **Step 2: Create the spouse rel after a parent-child rel is added**

In the POST handler, replace the final create + return:

```ts
  const rel = await Relationship.create({ treeId, type, person1Id, person2Id });
  return NextResponse.json(rel, { status: 201 });
```

with:

```ts
  const rel = await Relationship.create({ treeId, type, person1Id, person2Id });

  if (type === "parent-child") {
    const docs = await Relationship.find({ treeId }).lean();
    const rels = docs.map((d) => ({
      _id: String(d._id),
      treeId: String(d.treeId),
      type: d.type,
      person1Id: String(d.person1Id),
      person2Id: String(d.person2Id),
      endDate: d.endDate,
    })) as IRelationship[];
    const pair = coParentPairForChild(String(person2Id), rels);
    if (pair) {
      await Relationship.create({
        treeId,
        type: "spouse",
        person1Id: pair[0],
        person2Id: pair[1],
      });
    }
  }

  return NextResponse.json(rel, { status: 201 });
```

- [ ] **Step 3: Verify compile + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in this file (pre-existing unrelated lint issues may remain).

- [ ] **Step 4: Commit**

```bash
git add "app/api/trees/[treeId]/relationships/route.ts"
git commit -m "feat: auto-create spouse link when a child gains a second parent"
```

---

### Task 6: Client one-time reconcile trigger

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

**Interfaces:**
- Consumes: `treeMeta.coParentBackfillAt` (Task 3 DTO), `mutateRels`, `mutateTree`, `isOwner`, `treeId` (all existing in the component).

- [ ] **Step 1: Add a ran-once ref**

Near the other `useRef` declarations in the component (e.g. by `photoInputRef`), add:

```ts
  const reconcileRan = useRef(false);
```

(Confirm `useRef` is already imported from `"react"`; it is used by `photoInputRef`.)

- [ ] **Step 2: Add the trigger effect**

After the existing localStorage effects (after the `tree-root-siblings` effects, before `hiddenIds`), add:

```ts
  useEffect(() => {
    if (!isOwner || !treeMeta || treeMeta.coParentBackfillAt) return;
    if (reconcileRan.current) return;
    reconcileRan.current = true;
    (async () => {
      const res = await fetch(`/api/trees/${treeId}/reconcile-couples`, { method: "POST" });
      if (res.ok) {
        const data = await res.json().catch(() => ({ created: 0 }));
        await mutateTree();
        if (data.created > 0) await mutateRels();
      }
    })();
  }, [isOwner, treeMeta, treeId, mutateRels, mutateTree]);
```

- [ ] **Step 3: Verify compile + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors in this file.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/trees/[treeId]/page.tsx"
git commit -m "feat: trigger one-time co-parent backfill on owner tree load"
```

- [ ] **Step 5: Manual end-to-end verification (deferred — interactive)**

Run `npm run dev`. As owner, open tree `…85c01a`:
- Makedon + Luba render as one couple card, **female left / male right**, with a marriage line.
- Both profiles list each other as spouse.
- Divorce on the profile → `div.` badge on the couple; unlink → removed; **reload does not recreate** it.
- Add a new person with two existing parents selected → those parents become a couple automatically.
- Existing couples (Lali+Feokhar) unchanged except guaranteed female-left/male-right.

---

## Self-review notes

- **Spec coverage:** co-parent detection (Task 1) ✓; persisted spouse link via backfill (Task 4) + going-forward (Task 5) ✓; one-time/flag to avoid resurrection (Task 3 + Task 4 guard + Task 6 gate) ✓; divorce/unlink reuse existing UI (no task needed) ✓; female-left/male-right ordering (Task 2) ✓.
- **Type consistency:** helper signatures (`coParentPairForChild`, `coParentPairsNeedingSpouse`) identical across Tasks 1/4/5. `coParentBackfillAt` is `Date` on the doc, `string` on the DTO, consistent. Mongoose ObjectIds are `String(...)`-mapped before the helpers in Tasks 4 and 5.
- **Resurrection trade-off** documented in spec; going-forward creation is scoped to the affected child only.
