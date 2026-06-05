# Sibling Layout & Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sibling relationship to the Link People dialog (via shared parent), and guarantee siblings appear side by side in the family tree canvas.

**Architecture:** Two independent changes — (1) extend the Link People dialog state/UI/submit to handle a "sibling" type that creates two `parent-child` relationships via a shared parent, (2) post-process dagre output in `treeLayout.ts` to reposition children of the same parent so they are adjacent and centered under that parent.

**Tech Stack:** Next.js 16 App Router, React 19, next-intl (i18n), dagre (tree layout), @xyflow/react

---

## File Map

| File | Change |
|---|---|
| `messages/en.json` | Add `tree.sibling`, `tree.sharedParent` keys |
| `messages/ka.json` | Same, Georgian translations |
| `messages/he.json` | Same, Hebrew translations |
| `app/(dashboard)/trees/[treeId]/page.tsx` | Add `linkParent` state, extend `linkType`, update `submitLink`, add sibling UI to dialog |
| `lib/treeLayout.ts` | Post-process sibling positions after dagre |

---

## Task 1: Add i18n keys for sibling linking

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ka.json`
- Modify: `messages/he.json`

- [ ] **Step 1: Add keys to en.json**

In `messages/en.json`, inside the `"tree"` object, add after `"parentChild"`:

```json
"sibling": "Siblings (shared parent)",
"sharedParent": "Shared parent"
```

Result in file:

```json
"tree": {
  ...
  "parentChild": "Parent → Child (Person 1 is parent)",
  "sibling": "Siblings (shared parent)",
  "sharedParent": "Shared parent"
}
```

- [ ] **Step 2: Add keys to ka.json**

In `messages/ka.json`, inside the `"tree"` object, add after `"parentChild"`:

```json
"sibling": "და-ძმები (საერთო მშობელი)",
"sharedParent": "საერთო მშობელი"
```

- [ ] **Step 3: Add keys to he.json**

In `messages/he.json`, inside the `"tree"` object, add after `"parentChild"`:

```json
"sibling": "אחים (הורה משותף)",
"sharedParent": "הורה משותף"
```

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/ka.json messages/he.json
git commit -m "feat: add sibling i18n keys to all locales"
```

---

## Task 2: Extend Link People dialog with sibling support

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

The current link dialog state lives around line 108–112. The `submitLink` function is around line 229. The dialog UI is around line 333.

- [ ] **Step 1: Add `linkParent` state**

Find this block (around line 108):

```ts
  // Link two existing persons
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkP1, setLinkP1] = useState("");
  const [linkP2, setLinkP2] = useState("");
  const [linkType, setLinkType] = useState<"parent-child" | "spouse">("spouse");
  const [linkSaving, setLinkSaving] = useState(false);
```

Replace with:

```ts
  // Link two existing persons
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkP1, setLinkP1] = useState("");
  const [linkP2, setLinkP2] = useState("");
  const [linkType, setLinkType] = useState<"parent-child" | "spouse" | "sibling">("spouse");
  const [linkParent, setLinkParent] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
```

- [ ] **Step 2: Update `submitLink` to handle sibling case**

Find the entire `submitLink` function (around line 229):

```ts
  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkP1 || !linkP2 || linkP1 === linkP2) return;
    setLinkSaving(true);
    await fetch(`/api/trees/${treeId}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: linkType, person1Id: linkP1, person2Id: linkP2 }),
    });
    await mutateRels();
    setLinkOpen(false);
    setLinkP1("");
    setLinkP2("");
    setLinkSaving(false);
  }
```

Replace with:

```ts
  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkP1 || !linkP2 || linkP1 === linkP2) return;
    if (linkType === "sibling" && !linkParent) return;
    setLinkSaving(true);

    if (linkType === "sibling") {
      await Promise.all([
        fetch(`/api/trees/${treeId}/relationships`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "parent-child", person1Id: linkParent, person2Id: linkP1 }),
        }),
        fetch(`/api/trees/${treeId}/relationships`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "parent-child", person1Id: linkParent, person2Id: linkP2 }),
        }),
      ]);
    } else {
      await fetch(`/api/trees/${treeId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: linkType, person1Id: linkP1, person2Id: linkP2 }),
      });
    }

    await mutateRels();
    setLinkOpen(false);
    setLinkP1("");
    setLinkP2("");
    setLinkParent("");
    setLinkType("spouse");
    setLinkSaving(false);
  }
```

- [ ] **Step 3: Add sibling option and shared-parent picker to dialog UI**

Find the relationship `<Select>` inside the link dialog (around line 354):

```tsx
            <div className="space-y-1">
              <Label>{t("relationship")}</Label>
              <Select value={linkType} onValueChange={(v) => setLinkType(v as "parent-child" | "spouse")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">{t("spouse")}</SelectItem>
                  <SelectItem value="parent-child">{t("parentChild")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
```

Replace with:

```tsx
            <div className="space-y-1">
              <Label>{t("relationship")}</Label>
              <Select value={linkType} onValueChange={(v) => setLinkType(v as "parent-child" | "spouse" | "sibling")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">{t("spouse")}</SelectItem>
                  <SelectItem value="parent-child">{t("parentChild")}</SelectItem>
                  <SelectItem value="sibling">{t("sibling")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {linkType === "sibling" && (
              <div className="space-y-1">
                <Label>{t("sharedParent")}</Label>
                <Select value={linkParent} onValueChange={(v) => setLinkParent(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder={t("selectPerson")} /></SelectTrigger>
                  <SelectContent>
                    {persons
                      .filter((p) => p._id !== linkP1 && p._id !== linkP2)
                      .map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.firstName} {p.lastName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
```

- [ ] **Step 4: Update submit button disabled condition**

Find:

```tsx
            <Button type="submit" className="w-full" disabled={!linkP1 || !linkP2 || linkSaving}>
```

Replace with:

```tsx
            <Button type="submit" className="w-full" disabled={!linkP1 || !linkP2 || (linkType === "sibling" && !linkParent) || linkSaving}>
```

- [ ] **Step 5: Manual verify**

Start dev server (`npm run dev`). Open a tree with at least 3 people.
1. Click "Link people"
2. Select two people
3. Change relationship to "Siblings (shared parent)"
4. Verify a third "Shared parent" dropdown appears
5. Select a parent and submit
6. Verify tree reloads and both people connect to the shared parent

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/trees/\[treeId\]/page.tsx
git commit -m "feat: add sibling relationship to link people dialog via shared parent"
```

---

## Task 3: Post-process sibling positions in treeLayout.ts

**Files:**
- Modify: `lib/treeLayout.ts`

The goal: after dagre assigns positions, find all nodes that share a parent (via edges), and reposition them so they are evenly spaced and centered under their parent. Y positions are unchanged.

- [ ] **Step 1: Extract NODESEP constant and rewrite treeLayout.ts**

Replace the entire contents of `lib/treeLayout.ts` with:

```ts
import dagre from "dagre";

const PERSON_W = 168;
const COUPLE_W = 200;
const NODE_H = 90;
const NODESEP = 60;

type MinimalNode = { id: string; type?: string };
type MinimalEdge = { source: string; target: string };

export function applyDagreLayout<T extends MinimalNode>(
  nodes: T[],
  edges: MinimalEdge[]
): T[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 130, nodesep: NODESEP, marginx: 60, marginy: 60 });

  nodes.forEach((n) => {
    g.setNode(n.id, {
      width: n.type === "coupleNode" ? COUPLE_W : PERSON_W,
      height: NODE_H,
    });
  });

  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  // Capture dagre center positions
  const centerPos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => {
    const pos = g.node(n.id);
    centerPos.set(n.id, { x: pos.x, y: pos.y });
  });

  // Build parent → children map
  const childrenMap = new Map<string, string[]>();
  edges.forEach((e) => {
    const kids = childrenMap.get(e.source) ?? [];
    kids.push(e.target);
    childrenMap.set(e.source, kids);
  });

  // Reposition siblings: sort by current x, center group under parent
  childrenMap.forEach((childIds, parentId) => {
    if (childIds.length < 2) return;
    const parentPos = centerPos.get(parentId);
    if (!parentPos) return;

    childIds.sort((a, b) => (centerPos.get(a)?.x ?? 0) - (centerPos.get(b)?.x ?? 0));

    const widths = childIds.map((id) => {
      const node = nodes.find((n) => n.id === id);
      return node?.type === "coupleNode" ? COUPLE_W : PERSON_W;
    });

    const totalWidth =
      widths.reduce((sum, w) => sum + w, 0) + NODESEP * (childIds.length - 1);
    let x = parentPos.x - totalWidth / 2;

    childIds.forEach((id, i) => {
      centerPos.set(id, { x: x + widths[i] / 2, y: centerPos.get(id)!.y });
      x += widths[i] + NODESEP;
    });
  });

  // Convert center positions to top-left for React Flow
  return nodes.map((n) => {
    const pos = centerPos.get(n.id)!;
    const w = n.type === "coupleNode" ? COUPLE_W : PERSON_W;
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - NODE_H / 2 } };
  });
}
```

- [ ] **Step 2: Manual verify**

Start dev server. Open a tree where one person has 2+ children.
1. Verify children appear side by side at the same level
2. Verify they are centered under their parent
3. Verify spouse/couple nodes still render correctly
4. Verify the tree looks correct for single-child families (no change expected)

- [ ] **Step 3: Commit**

```bash
git add lib/treeLayout.ts
git commit -m "feat: reposition siblings adjacently under shared parent in tree layout"
```

---

## Task 4: Final integration verify & push

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 2: Push**

```bash
git push
```

Expected: Vercel picks up the new commits and deploys successfully.
