# Co-Parent Auto-Couple + Couple Gender Ordering Design

**Date:** 2026-07-01

## Problem

1. Two people who are parents of the same child but have **no spouse relationship** render as two separate nodes (e.g. Makedon + Luba, both parents of Feokhar). The user wants co-parents shown as a **couple**.
2. The user wants the link to be a **real** relationship so they can divorce/unlink it from the full profile (the existing divorce + unlink UI).
3. Couple cards must place the **female on the left, male on the right**. The current swap in `buildTreeData.ts` only handles one of several gender orderings.

## Investigation (ground truth)

- Tree `…85c01a`: `parent-child Makedon→Feokhar` and `parent-child Luba→Feokhar` exist; **no** `spouse` rel between Makedon and Luba → two separate `personNode`s.
- Existing couples (Lali+Feokhar) form because a `spouse` rel exists. `buildTreeData` already renders any `spouse` pair as a `CoupleNode`, shows them in both profiles, and supports divorce (`endDate`) + unlink (DELETE).
- Current ordering: `buildTreeData.ts:162` — `if (p1.gender === "male" && p2.gender === "female") [p1,p2] = [p2,p1]`. Only swaps the male-first/female-second case; female-first, male+unknown, etc. are left as-is.

## Decisions

- **Co-parents become a real, persisted `spouse` relationship** (chosen over visual-only) so divorce/unlink work unchanged.
- **Backfill existing data once per tree** (guarded by a flag) so a later unlink is **not** resurrected on reload.
- **Going forward**, auto-create the spouse rel in the `POST /relationships` handler, scoped to the child in the new `parent-child` rel.
- Accepted trade-off: if a co-parent couple is unlinked and *later* another shared child is added, the going-forward rule re-creates the link. No suppression record for now (YAGNI).
- **Ordering:** deterministic rank — female = left slot, unknown/other = middle, male = right slot.

---

## Feature A: Auto-couple co-parents

### A1. Shared pure helper — `lib/coParentCouple.ts`

```ts
import type { IRelationship } from "@/types";

// All unordered parent pairs that co-parent some child with EXACTLY 2 parents
// and have NO spouse rel between them (in any state). Used by backfill + POST.
export function coParentPairsNeedingSpouse(
  relationships: IRelationship[]
): Array<[string, string]>

// Parents of a single child that need a spouse rel created (0 or 1 pair).
// Used by the POST handler, scoped to the affected child.
export function coParentPairForChild(
  childId: string,
  relationships: IRelationship[]
): [string, string] | null
```

Logic (both share a `hasSpouseBetween(a, b, rels)` predicate):
- Build `childId → parentIds[]` from `parent-child` rels.
- A child qualifies only when it has **exactly 2** distinct parents.
- A pair qualifies only when **no** `spouse` rel exists between them in either direction (regardless of `endDate`).
- `coParentPairsNeedingSpouse` returns the deduped set of qualifying pairs across all children.

Pure, deterministic, unit-tested with Vitest.

### A2. Tree flag — `lib/models/Tree.ts` + `types/index.ts`

- Add `coParentBackfillAt?: Date` to `ITreeDoc` and the schema (no default → unset means "never backfilled").
- Add `coParentBackfillAt?: string` to the `ITree` DTO. The tree `GET` already spreads `tree.toObject()`, so the field is returned automatically — no route change.

### A3. Backfill endpoint — `app/api/trees/[treeId]/reconcile-couples/route.ts`

`POST` — owner only (`Tree.findOne({ _id, ownerId })`):
- If `tree.coParentBackfillAt` is already set → return `{ created: 0, alreadyDone: true }` (no work, prevents resurrection).
- Else: compute `coParentPairsNeedingSpouse(rels)` for the tree, `insertMany` a `spouse` rel for each pair (no `endDate`), set `tree.coParentBackfillAt = new Date()`, save. Return `{ created: n }`.
- Standard `auth()` → 401 pattern.

### A4. Going-forward — `app/api/trees/[treeId]/relationships/route.ts` POST

After the existing `Relationship.create(...)`, when the created rel is `type === "parent-child"`:
- Re-read the tree's relationships, call `coParentPairForChild(person2Id, rels)`.
- If it returns a pair, create the `spouse` rel for it (no `endDate`).
- Return the originally created rel (unchanged response shape).
- Scope to the affected child only — does not blanket-create, minimizing resurrection of unlinked pairs.

### A5. Client trigger — `app/(dashboard)/trees/[treeId]/page.tsx`

- Add an effect: when `isOwner && treeMeta && !treeMeta.coParentBackfillAt`, `POST /api/trees/${treeId}/reconcile-couples` once, then `await mutateRels()` and `await mutateTree()` (so the flag updates and the effect doesn't refire).
- Guard with a ref so it fires at most once per mount.

### A6. Separation (already exists — no change)

Profile page divorce dialog (`endDate`) and unlink (DELETE relationship) operate on the auto-created spouse rel exactly as for any spouse.

---

## Feature B: Couple gender ordering (female left, male right)

In `lib/buildTreeData.ts`, replace the partial swap at the regular-couple construction with a deterministic rank:

```ts
const slotRank = (g: IPerson["gender"]) =>
  g === "female" ? 0 : g === "male" ? 2 : 1;
if (slotRank(p1.gender) > slotRank(p2.gender)) [p1, p2] = [p2, p1];
```

- `person1` is the left slot, `person2` the right (per `CoupleNode` render order).
- Result: female → left, male → right; unknown/other sits between; equal ranks keep stable order.
- Downstream `coupleSlot`/edge-handle logic keys off person ids, so reordering is safe.
- **Poly-couple node ordering is out of scope** (husband-centred layout differs); leave as-is.

---

## Out of scope (YAGNI)

- Suppression record to make co-parent unlink permanent across future shared-child additions.
- Auto-coupling for children with 3+ parents (step-parents) — skipped by the exactly-2 guard.
- Reordering the poly-couple (2-spouse) node.
- Backfill re-runs (one-time per tree by design).

## Testing

- Unit (Vitest): `coParentPairsNeedingSpouse` + `coParentPairForChild` — 2-parent detection, exactly-2 guard (1 and 3 parents → none), skip when spouse rel exists (incl. divorced), dedup across multiple shared children, empty cases.
- Unit (Vitest): `buildTreeData` ordering — female-left/male-right for female-first, male-first, and unknown+male inputs.
- Manual: open tree `…85c01a` as owner → Makedon+Luba become a couple card (female left, male right); both profiles show the spouse; divorce shows `div.` badge; unlink removes it and reload does not recreate it; adding a new 2-parent child auto-couples its parents.

## Files

- `lib/coParentCouple.ts` (new) + `lib/coParentCouple.test.ts` (new)
- `lib/models/Tree.ts` — add `coParentBackfillAt`
- `types/index.ts` — add `coParentBackfillAt?` to `ITree`
- `app/api/trees/[treeId]/reconcile-couples/route.ts` (new)
- `app/api/trees/[treeId]/relationships/route.ts` — going-forward co-parent spouse creation
- `app/(dashboard)/trees/[treeId]/page.tsx` — one-time reconcile trigger
- `lib/buildTreeData.ts` — gender ordering (+ `lib/buildTreeData.ordering.test.ts` new)
