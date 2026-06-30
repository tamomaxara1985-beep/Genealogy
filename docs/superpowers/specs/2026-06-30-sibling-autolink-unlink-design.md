# Sibling Auto-Link, Unlink & Divorce Design

**Date:** 2026-06-30

## Problem

The user wants, per person:

1. Siblings and spouses linked **automatically** (in the profile and in the tree).
2. A way to **unlink** those links manually.
3. A **divorce** feature that separates spouses while preserving their records and tree relationships.

## Current state (investigation)

Most of the request already exists:

- **Spouse linking** — `Relationship` of `type: "spouse"`. Shown automatically in both persons' profiles (`person/[personId]/page.tsx` Spouses section). Linked in the tree via `CoupleNode` / `PolyCoupleNode`.
- **Unlink** — the profile already renders an `unlink` button on Parents, Spouses, and Children rows, calling `DELETE /api/trees/[treeId]/relationships/[relId]`. Backend handler exists and is complete.
- **Divorce** — the profile already has a divorce dialog that PATCHes `endDate` on the spouse relationship (`PATCH /api/trees/[treeId]/relationships/[relId]`). The relationship and all records are preserved; the tree shows a `div.` badge (`isDivorced` in `buildTreeData.ts`, `CoupleNode`, `PolyCoupleNode`).

**The only real gap is siblings.** Siblings are *derived* from a shared parent (there is no sibling row in the DB). The profile shows Parents / Spouses / Children but has **no Siblings section**. The tree already clusters siblings via shared-parent edges.

Therefore this design adds: a **Siblings section** in the profile (auto-derived) plus a **non-destructive unlink** for siblings. Spouse-link, unlink, and divorce are left untouched.

## Decisions

- **Sibling model:** Derived + hide-list. Keep deriving siblings from shared parents (no auto-created sibling rows). "Unlink" stores a per-pair *suppression* record that hides the pairing without touching parentage. Reversible.
- **Unlink scope:** Mutual. One suppression record per unordered pair → A drops B and B drops A.
- **Tree effect:** Profile list only. Suppression hides a sibling in the profile Siblings section. Tree layout/adjacency is unchanged (siblings still truly share a parent edge).

---

## Feature: Sibling Auto-Link + Unlink

### 1. Data model — `SiblingHide`

New Mongoose model `lib/models/SiblingHide.ts`. **No change to `Relationship`.**

```ts
interface ISiblingHideDoc extends Document {
  treeId: ObjectId;   // ref Tree
  personAId: ObjectId; // ref Person — normalized: personAId < personBId (string compare)
  personBId: ObjectId; // ref Person
}
// timestamps: true
// hot-reload guard: models.SiblingHide ?? model("SiblingHide", schema)
```

- The pair is **order-normalized** on write (sort the two ids lexicographically) so a single row covers both directions → mutual hide by construction, and lookup is direction-agnostic.
- Compound index on `{ treeId, personAId, personBId }` (unique) to dedup.
- DTO `ISiblingHide` added to `types/index.ts` (single source of truth).

### 2. API — `/api/trees/[treeId]/sibling-hides`

`app/api/trees/[treeId]/sibling-hides/route.ts`:

- `GET` — list hides for the tree. Access via `resolveTreeAccess` (owner or viewer), mirroring the relationships GET handler.
- `POST { personAId, personBId }` — owner only (`Tree.findOne({ _id, ownerId })`). Normalize the pair order, then upsert (skip silently if it already exists). Return 201.

`app/api/trees/[treeId]/sibling-hides/[hideId]/route.ts`:

- `DELETE` — owner only. Remove the hide row (= re-link the siblings). Return `{ ok: true }`.

Both follow the existing auth pattern: `await auth()` → 401 if no session; ownership check for writes.

### 3. Derivation util — `lib/deriveSiblings.ts`

Pure, unit-testable function reused by the profile:

```ts
export function siblingIdsOf(
  personId: string,
  relationships: IRelationship[],
  hides: ISiblingHide[]
): string[]
```

Algorithm:
1. `parentIds` = `person1Id` of every `parent-child` rel where `person2Id === personId`.
2. `siblingIds` = distinct `person2Id` of every `parent-child` rel where `person1Id ∈ parentIds`, excluding `personId` itself.
3. Build a `Set` of normalized hidden pairs from `hides`. Drop any sibling `q` where the normalized pair `{personId, q}` is in that set.
4. Return the remaining ids.

A companion helper returns the **hidden** sibling ids for this person (those derived in step 1–2 but removed in step 3) so the profile can offer re-link.

### 4. Profile UI — `app/(dashboard)/person/[personId]/page.tsx`

- Add SWR fetch of `/api/trees/${treeId}/sibling-hides` (`mutateHides`).
- Compute `siblingIds` and `hiddenSiblingIds` via the derivation util.
- New **Siblings** section, placed after Parents (before Spouses):
  - Lists each derived sibling as a `PersonLink`.
  - Owner sees an `unlink` button per row → `POST sibling-hides { personAId: personId, personBId: siblingId }` then `mutateHides()`.
  - Section hidden entirely when there are no derived siblings.
- A muted **"Hidden siblings"** subsection, shown only when `hiddenSiblingIds` is non-empty:
  - Each row → `relink` button → `DELETE sibling-hides/[hideId]` then `mutateHides()`.
  - Requires mapping a hidden sibling id back to its hide row id (match normalized pair).
- `hasRelationships` updated to include siblings so the empty-state copy stays correct.

Styling matches existing sections (same `text-[11px]` label, same unlink button classes).

### 5. Tree

No change. Siblings already cluster via shared-parent edges; spouses already render as couples; divorce badge already shows. The profile-list-only decision means suppression does not touch the canvas.

### 6. i18n

Add keys under the `person` namespace in `messages/en.json`, `messages/ka.json`, `messages/he.json`: `siblings`, `hiddenSiblings`, `relink`. Reuse the existing `unlink` string if present, else add it.

---

## Out of scope (YAGNI)

- Manually creating a sibling from the profile (sharing a parent already links them; the tree page's "Link People" dialog already has a sibling-via-shared-parent option).
- Breaking sibling adjacency/clustering in the tree canvas.
- Any new spouse-link, unlink, or divorce work — all three already exist and are preserved as-is.
- Ordering siblings by birth date.

## Testing

- Unit-test `siblingIdsOf`: shared-parent derivation, self-exclusion, dedup across two shared parents, hide filtering (mutual), empty cases.
- Manual: profile shows auto-siblings; unlink hides mutually (verify on both profiles); relink restores; tree unchanged; divorce + spouse unlink still work.

## Files

- `lib/models/SiblingHide.ts` (new)
- `app/api/trees/[treeId]/sibling-hides/route.ts` (new)
- `app/api/trees/[treeId]/sibling-hides/[hideId]/route.ts` (new)
- `lib/deriveSiblings.ts` (new)
- `types/index.ts` — add `ISiblingHide`
- `app/(dashboard)/person/[personId]/page.tsx` — Siblings + Hidden siblings sections, SWR, handlers
- `messages/en.json`, `messages/ka.json`, `messages/he.json` — new keys
