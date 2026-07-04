# Live-Updating UI — Design

Date: 2026-07-04

## Problem

Two related symptoms:

1. **Own changes don't reflect on the family-tree canvas.** Editing a person's
   fields (death date, name, photo, deceased flag) saves to the DB and SWR
   refetches, but the canvas card keeps showing the old data until a node is
   added/removed or the page is hard-refreshed. This is the actual cause of the
   earlier "can't save Lina's death date" report — the value *was* saved
   (`deathDate: "2020"`), the canvas just never re-rendered it.

2. **Other users'/tabs' changes don't appear** without a manual refresh.

## Root Cause (symptom 1)

`components/tree/FamilyTree.tsx` memoizes the laid-out nodes keyed only on the
concatenated node/edge **IDs**:

```ts
const nodeIds = rawNodes.map((n) => n.id).join(",");
const edgeIds = rawEdges.map((e) => e.id).join(",");
const layoutNodes = useMemo(() => applyDagreLayout(rawNodes, rawEdges), [nodeIds, edgeIds]);
```

Add/delete/expand change the ID set → re-layout runs. But a **field edit** leaves
the ID set unchanged, so the memo returns the previously cached nodes with stale
`data`. `setNodes` is therefore never called with the fresh person data.

Every mutation site already calls SWR `mutate()` (verified across
`trees/page.tsx`, `trees/[treeId]/page.tsx`, `person/[personId]/page.tsx`,
`admin/*`, `contact`), so refetching is not the gap — only the canvas render is.

## Goals

- A user's own add/edit/delete is visible immediately, no manual refresh —
  including field edits on the tree canvas.
- Changes made by other users or in another tab appear without a manual
  refresh (within a short interval, or instantly on tab focus).
- Preserve the current tree layout/appearance; a content edit must not move
  nodes or jump the viewport.

## Non-Goals

- Sub-second websocket/push propagation (rejected: Vercel serverless can't hold
  long-lived connections; would need an external realtime service + cost). Not
  worth it for this app.
- Changing how mutations are performed (`mutate()` coverage is already complete).

## Design

### Part A — instant reflection of the user's own changes

**New pure helper** `lib/treeNodesSignature.ts`:

```ts
import type { ... } from ...; // node/person types
export function nodesContentSignature(nodes: AnyNode[]): string
```

- Produces a string capturing the display-relevant fields of every person across
  the three node kinds. For each node, gather the people it renders
  (`data.person` | `data.person1`+`data.person2` |
  `data.leftSpouse`+`data.shared`+`data.rightSpouse`) and emit
  `` `${_id}:${firstName}:${lastName}:${birthDate}:${deathDate}:${isLiving}:${photoUrl}` `` joined,
  plus per-node `siblingInfo`/`isCollapsed` display flags that live in `data`
  rather than the ID set.
- Pure and deterministic → unit-testable.

**`components/tree/FamilyTree.tsx` changes:**

1. Compute `const contentSig = nodesContentSignature(rawNodes);`.
2. Add `contentSig` to the `layoutNodes` `useMemo` dependency array (with
   `nodeIds`, `edgeIds`). Because dagre positions depend only on graph structure
   (IDs + edges + node-type widths), re-running layout on a content-only change
   yields **identical positions** — fresh `data`, no visual jump.
3. **Split the layout-sync effect from the fit-view effect:**
   - `setNodes(layoutNodes)` runs whenever `layoutNodes` changes (structure or
     content) — so edits render.
   - the `fitView` re-fit runs only when `nodeIds` changes (structure) — so
     editing a field does not yank/re-center the viewport. First-mount fit is
     still handled by ReactFlow's `fitView` prop.

Data flow after fix: edit death date → PUT → `mutatePersons()` (existing) →
`persons` updates → `buildTreeData` rebuilds `rawNodes` with new data →
`contentSig` changes → `layoutNodes` recomputes (same positions, new data) →
`setNodes` → card shows `2020` immediately.

### Part B — cross-user / cross-tab freshness (polling)

Wrap the app in `SWRConfig` inside `components/providers.tsx` (already a client
component wrapping `SessionProvider`):

```tsx
<SWRConfig value={{
  refreshInterval: 20000,       // poll every 20s
  revalidateOnFocus: true,      // instant refresh when a tab regains focus (SWR default)
  revalidateOnReconnect: true,  // on network regain (SWR default)
  dedupingInterval: 5000,       // collapse duplicate requests in a 5s window
}}>
  {children}
</SWRConfig>
```

- Every `useSWR` hook app-wide inherits these defaults; no per-hook changes.
- Others' changes appear within ~20s, or immediately when the user refocuses the
  tab.
- SWR deep-compares responses, so an unchanged poll produces no new reference and
  no re-render (the tree's `contentSig` is unchanged → no relayout).
- SWR does not poll hidden/background tabs by default (`refreshWhenHidden`
  false), limiting load.

## Files touched

- `lib/treeNodesSignature.ts` — new pure helper (create).
- `lib/treeNodesSignature.test.ts` — unit test (create).
- `components/tree/FamilyTree.tsx` — signature in memo deps; split fit-view
  effect.
- `components/providers.tsx` — add `SWRConfig` wrapper.

## Risk

- **Global 20s polling** adds light request load (per open page, per SWR key,
  only while the tab is visible). Fine for the current small user base; the
  interval is a one-line tune later.
- The FamilyTree memo change touches the layout the user is happy with.
  Positions are structure-keyed and stay identical on content edits; must be
  verified against add/delete/expand and a field edit to confirm no regression
  or viewport jump.
- No automated test for the React component itself (repo convention); the
  extracted signature helper is unit-tested, and the canvas behavior is verified
  manually.

## Verification

- Edit a person's death date on the tree → the card updates immediately, no
  refresh; positions and viewport unchanged.
- Add a person → appears (as today); delete → disappears (as today); expand
  siblings → reveals (as today) — no regression.
- Open the same tree in two tabs; edit in one → the other reflects it within
  ~20s, or immediately when refocused.
- `npm run lint`, `npm test` (existing + new signature test), `npm run build`
  all pass.
