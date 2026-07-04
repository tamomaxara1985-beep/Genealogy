# Show Root's Spouse's Ancestors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the ancestor pedigree of the main person's spouse(s) in the default tree view, with in-law collateral collapsed-by-default (symmetric with the root's own line).

**Architecture:** Visibility-only change. `getCoreVisible` adds each root spouse + their ancestors; the tree page's `spineIds` adds the same so the in-law line gets the collapse/+N-badge treatment. The existing two-sided root-couple ancestor fan and collapse machinery render it — no layout change.

**Tech Stack:** Next.js 16, React 19, TypeScript, vitest.

## Global Constraints

- Path alias `@/*` = project root. Run `npm test` after touching tested lib code (vitest).
- Scope: the ROOT's spouse(s) only — not in-laws of every married-in person.
- No layout change; reuse the existing fan + `expandedSiblingIds`/`hiddenIds` collapse machinery.
- In-law collateral (spouse's siblings, in-law great-aunts) stays collapsed by default.

---

### Task 1: `getSpouses` helper + `getCoreVisible` includes root's spouse ancestors

**Files:**
- Modify: `lib/treeCollapse.ts`
- Test: `lib/treeCollapse.test.ts`

**Interfaces:**
- Produces: `getSpouses(personId: string, relationships: IRelationship[]): Set<string>` (partner ids). `getCoreVisible` now also includes each root spouse and that spouse's ancestors.

- [ ] **Step 1: Write failing tests**

Append to `lib/treeCollapse.test.ts` (helpers `pc`/`sp` already defined there):

```ts
  it("getSpouses returns partners in both directions", () => {
    const rels = [sp("a", "b"), sp("c", "a")];
    const out = getSpouses("a", rels);
    expect([...out].sort()).toEqual(["b", "c"]);
  });

  it("getCoreVisible includes the root's spouse's parents (in-law pedigree)", () => {
    const rels = [sp("root", "wife"), pc("wifeDad", "wife"), pc("wifeMom", "wife"), pc("wifeGpa", "wifeDad")];
    const core = getCoreVisible("root", rels);
    ["wife", "wifeDad", "wifeMom", "wifeGpa"].forEach((id) => expect(core.has(id)).toBe(true));
  });

  it("getCoreVisible does NOT include the root spouse's siblings (in-law collateral stays collapsed)", () => {
    const rels = [sp("root", "wife"), pc("wifeDad", "wife"), pc("wifeDad", "wifeSister")];
    expect(getCoreVisible("root", rels).has("wifeSister")).toBe(false);
  });
```

Add `getSpouses` to the import in the test file's top `import { ... } from "./treeCollapse"` line.

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- treeCollapse`
Expected: FAIL — `getSpouses` not exported / root spouse's parents not in core.

- [ ] **Step 3: Add `getSpouses` and extend `getCoreVisible`**

In `lib/treeCollapse.ts`, add the helper (e.g. after `getSiblings`):

```ts
/**
 * Partner ids of a person via spouse relationships (both directions).
 */
export function getSpouses(
  personId: string,
  relationships: IRelationship[]
): Set<string> {
  const out = new Set<string>();
  for (const r of relationships) {
    if (r.type !== "spouse") continue;
    if (r.person1Id === personId) out.add(r.person2Id);
    else if (r.person2Id === personId) out.add(r.person1Id);
  }
  return out;
}
```

In `getCoreVisible`, after the descendants block and BEFORE the `coreSnapshot` spouse-card step, insert:

```ts
  // Root's spouse(s) and their ancestors — show the in-law pedigree on the
  // spouse's side of the root couple (collateral stays collapsed by default).
  for (const sp of getSpouses(rootId, relationships)) {
    core.add(sp);
    getAncestors(sp, relationships).forEach((id) => core.add(id));
  }
```

(Leave the existing `coreSnapshot` spouse-of-any-core step as-is; update the function's doc comment to mention the root spouse's ancestors.)

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- treeCollapse`
Expected: PASS (new 3 tests + existing).

- [ ] **Step 5: Commit**

```bash
git add lib/treeCollapse.ts lib/treeCollapse.test.ts
git commit -m "feat: getCoreVisible includes root spouse's ancestors (in-law pedigree)"
```

---

### Task 2: `spineIds` includes the root spouse line (collapse/badge treatment)

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

**Interfaces:**
- Consumes: `getSpouses` (Task 1), existing `getAncestors`.

- [ ] **Step 1: Import `getSpouses`**

The current import line is:

```ts
import { getAncestors, getSiblings, getCoreVisible } from "@/lib/treeCollapse";
```

Change it to add `getSpouses`:

```ts
import { getAncestors, getSiblings, getCoreVisible, getSpouses } from "@/lib/treeCollapse";
```

- [ ] **Step 2: Extend `spineIds`**

The current memo is:

```ts
  const spineIds = useMemo(() => {
    const s = new Set<string>();
    if (!rootId) return s;
    s.add(rootId);
    getAncestors(rootId, relationships).forEach((id) => s.add(id));
    return s;
  }, [rootId, relationships]);
```

Replace with (add root spouse(s) + their ancestors, so the in-law line gets +N sibling badges / collapse):

```ts
  const spineIds = useMemo(() => {
    const s = new Set<string>();
    if (!rootId) return s;
    s.add(rootId);
    getAncestors(rootId, relationships).forEach((id) => s.add(id));
    getSpouses(rootId, relationships).forEach((sp) => {
      s.add(sp);
      getAncestors(sp, relationships).forEach((id) => s.add(id));
    });
    return s;
  }, [rootId, relationships]);
```

- [ ] **Step 3: Gate**

Grep to confirm `getSpouses` imported + used.

Run: `npm run lint` → no new errors (pre-existing DashboardClient error may remain).
Run: `npm test` → all green.
Run: `npm run build` → clean. (If NextAuth "Unexpected token '<'"/api 404, wipe `.next` and rebuild.)

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/trees/[treeId]/page.tsx"
git commit -m "feat: in-law pedigree (root spouse's ancestors) gets collapse/sibling-badge treatment"
```

---

### Task 3: Verification

**Files:** none.

- [ ] **Step 1:** `npm run dev` (background), open a tree whose root has a spouse with recorded parents/grandparents.

> If `/api/auth` 404s or NextAuth throws "Unexpected token '<'", stop, wipe `.next`, `npm run dev` again.

- [ ] **Step 2:** Confirm the spouse's parents/grandparents now appear on the spouse's side of the root couple (in-law pedigree fans upward), symmetric with the root's line.
- [ ] **Step 3:** Confirm in-law collateral (spouse's siblings) is hidden by default and the spouse / in-law ancestors show a +N badge that reveals them.
- [ ] **Step 4:** Confirm the root's own line is unchanged; a root with no spouse, or a spouse with no recorded parents, shows nothing extra (graceful).
- [ ] **Step 5:** Final gate `npm run lint && npm test && npm run build` all pass. Report results with output.
