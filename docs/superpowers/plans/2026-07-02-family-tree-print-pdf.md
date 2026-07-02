# Family Tree Print / Export to PDF (A4–A1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user download their family tree as a single-sheet PDF at A4, A3, A2, or A1, with the whole tree scaled to fit and orientation chosen automatically.

**Architecture:** Fully client-side. A print menu in the tree canvas calls `exportTreeToPdf`, which uses React Flow's `getNodesBounds`/`getViewportForBounds` to frame the whole graph, `html-to-image`'s `toPng` to raster the viewport layer (nodes + edges only), and `jsPDF` to place that image on an A-sized page scaled to fit.

**Tech Stack:** Next.js 16, React 19, TypeScript, `@xyflow/react` v12, `html-to-image`, `jspdf`, next-intl, shadcn/ui, vitest.

## Global Constraints

- Next.js 16 App Router — read `node_modules/next/dist/docs/` before writing Next.js code if unsure.
- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/components/...`.
- Fully client-side — no server route, no puppeteer. New deps: `html-to-image`, `jspdf` (both client-only).
- Capture target is the `.react-flow__viewport` element (excludes Background/Controls/MiniMap chrome).
- Paper sizes: A4, A3, A2, A1 — delegate to jsPDF's built-in `a1..a4` formats (lowercase). Size labels are literal, NOT translated.
- Orientation: `landscape` when `bounds.width >= bounds.height`, else `portrait`.
- Raster cap: `MAX_PX = 4000` on the longest side; `scale = min(2, MAX_PX / max(rawW, rawH))` — keeps A1 within browser canvas limits.
- Emerald accent scheme (`emerald-*`); compose classes with `cn()`; lucide icons only.
- All three `messages/*.json` stay key-parallel.
- Test runner is vitest (`npm test`). Only the pure fit-math is unit-tested; DOM/PDF paths are verified manually + `npm run build`.
- Commit after each task.

---

### Task 1: Export utility + pure fit math (with test)

**Files:**
- Modify: `package.json` (add deps)
- Create: `lib/exportTree.ts`
- Create: `lib/exportTree.test.ts`

**Interfaces:**
- Consumes: `getNodesBounds`, `getViewportForBounds`, `Node` from `@xyflow/react`; `toPng` from `html-to-image`; `jsPDF` from `jspdf`.
- Produces:
  - `export type PaperSize = "A4" | "A3" | "A2" | "A1"`
  - `export function computeFit(imgW: number, imgH: number, availW: number, availH: number): { drawW: number; drawH: number }`
  - `export async function exportTreeToPdf(args: { nodes: Node[]; paper: PaperSize; title?: string }): Promise<void>`

- [ ] **Step 1: Install the two client libraries**

Run: `npm install html-to-image jspdf`
Expected: both added to `package.json` dependencies, no peer-dep errors.

- [ ] **Step 2: Write the failing test for the pure fit math**

Create `lib/exportTree.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeFit } from "./exportTree";

describe("computeFit", () => {
  it("constrains a wide image by width", () => {
    // 2:1 image into a 100x100 box -> width-bound, height 50
    expect(computeFit(200, 100, 100, 100)).toEqual({ drawW: 100, drawH: 50 });
  });

  it("constrains a tall image by height", () => {
    // 1:2 image into a 100x100 box -> height-bound, width 50
    expect(computeFit(100, 200, 100, 100)).toEqual({ drawW: 50, drawH: 100 });
  });

  it("fills exactly when aspect ratios match", () => {
    expect(computeFit(100, 100, 50, 50)).toEqual({ drawW: 50, drawH: 50 });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- exportTree`
Expected: FAIL — `computeFit` is not exported / module not found.

- [ ] **Step 4: Write `lib/exportTree.ts`**

```ts
import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

export type PaperSize = "A4" | "A3" | "A2" | "A1";

const PAD = 40;      // graph-space padding around the tree
const MAX_PX = 4000; // cap on the raster's longest side

/** Fit an image's aspect ratio into an available box; returns the drawn size. */
export function computeFit(
  imgW: number,
  imgH: number,
  availW: number,
  availH: number
): { drawW: number; drawH: number } {
  const ar = imgW / imgH;
  let drawW = availW;
  let drawH = availW / ar;
  if (drawH > availH) {
    drawH = availH;
    drawW = availH * ar;
  }
  return { drawW, drawH };
}

export async function exportTreeToPdf({
  nodes,
  paper,
  title,
}: {
  nodes: Node[];
  paper: PaperSize;
  title?: string;
}): Promise<void> {
  if (nodes.length === 0) throw new Error("empty-tree");

  const bounds = getNodesBounds(nodes);
  const rawW = bounds.width + PAD * 2;
  const rawH = bounds.height + PAD * 2;
  const scale = Math.min(2, MAX_PX / Math.max(rawW, rawH));
  const imgW = Math.round(rawW * scale);
  const imgH = Math.round(rawH * scale);

  const { x, y, zoom } = getViewportForBounds(bounds, imgW, imgH, 0.1, 2, 0.1);

  const el = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!el) throw new Error("no-canvas");

  const dataUrl = await toPng(el, {
    backgroundColor: "#ffffff",
    width: imgW,
    height: imgH,
    pixelRatio: 1,
    style: {
      width: `${imgW}px`,
      height: `${imgH}px`,
      transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    },
  });

  const landscape = bounds.width >= bounds.height;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: paper.toLowerCase(),
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const titleH = title ? 12 : 0;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2 - titleH;

  const { drawW, drawH } = computeFit(imgW, imgH, availW, availH);
  const dx = (pageW - drawW) / 2;
  const dy = margin + titleH + (availH - drawH) / 2;

  if (title) {
    doc.setFontSize(16);
    doc.text(title, pageW / 2, margin + 7, { align: "center" });
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, pageW / 2, margin + 12, {
      align: "center",
    });
    doc.setTextColor(0);
  }

  doc.addImage(dataUrl, "PNG", dx, dy, drawW, drawH);
  doc.save(`${(title || "family-tree").replace(/[^\w.-]+/g, "_")}.pdf`);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- exportTree`
Expected: PASS (3/3). Then `npx tsc --noEmit` → no errors in `lib/exportTree.ts`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/exportTree.ts lib/exportTree.test.ts
git commit -m "feat: add exportTreeToPdf util + fit math (html-to-image + jspdf)"
```

---

### Task 2: i18n keys

**Files:**
- Modify: `messages/en.json`, `messages/ka.json`, `messages/he.json` (the `tree` namespace)

**Interfaces:**
- Consumes: nothing.
- Produces: `tree.print`, `tree.printing`, `tree.printError` present in all three locales.

- [ ] **Step 1: Add keys to `messages/en.json`**

Inside the `"tree": { ... }` object, add:
```json
    "print": "Print",
    "printing": "Preparing…",
    "printError": "Could not generate the PDF. Please try again."
```

- [ ] **Step 2: Add keys to `messages/ka.json`**

Inside its `"tree"` object, add:
```json
    "print": "ბეჭდვა",
    "printing": "მზადდება…",
    "printError": "PDF ვერ შეიქმნა. სცადეთ თავიდან."
```

- [ ] **Step 3: Add keys to `messages/he.json`**

Inside its `"tree"` object, add:
```json
    "print": "הדפסה",
    "printing": "מכין…",
    "printError": "לא ניתן ליצור PDF. נסו שוב."
```

- [ ] **Step 4: Verify JSON parses**

Run: `npm run lint`
Expected: no new errors (a malformed JSON would fail the build/lint).

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/ka.json messages/he.json
git commit -m "feat: i18n keys for tree print (en/ka/he)"
```

---

### Task 3: Print menu in FamilyTree + tree-page wiring

**Files:**
- Modify: `components/tree/FamilyTree.tsx` (full file below)
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx:583`

**Interfaces:**
- Consumes: `exportTreeToPdf`, `PaperSize` from `@/lib/exportTree` (Task 1); `tree.print`/`printing`/`printError` (Task 2); existing shadcn `DropdownMenu` in `@/components/ui/dropdown-menu` (already used by `Navbar`).
- Produces: `FamilyTree` gains an optional `title?: string` prop.

- [ ] **Step 1: Replace `components/tree/FamilyTree.tsx` with:**

```tsx
"use client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  type Edge,
  type ReactFlowInstance,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PersonNode, type PersonNodeType } from "./PersonNode";
import { CoupleNode, type CoupleNodeType } from "./CoupleNode";
import { PolyCoupleNode, type PolyCoupleNodeType } from "./PolyCoupleNode";
import { applyDagreLayout } from "@/lib/treeLayout";
import { exportTreeToPdf, type PaperSize } from "@/lib/exportTree";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Printer, Loader2, ChevronDown } from "lucide-react";
import type { TreeEdge } from "@/types";

const nodeTypes = {
  personNode: PersonNode,
  coupleNode: CoupleNode,
  polyCoupleNode: PolyCoupleNode,
};

const PAPER_SIZES: PaperSize[] = ["A4", "A3", "A2", "A1"];

type AnyNode = PersonNodeType | CoupleNodeType | PolyCoupleNodeType;

interface Props {
  nodes: AnyNode[];
  edges: TreeEdge[];
  title?: string;
}

export function FamilyTree({ nodes: rawNodes, edges: rawEdges, title }: Props) {
  const t = useTranslations("tree");

  // Derive stable ID keys so useMemo deps are simple expressions
  const nodeIds = rawNodes.map((n) => n.id).join(",");
  const edgeIds = rawEdges.map((e) => e.id).join(",");

  const layoutNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges),
    // Re-layout only when node/edge IDs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeIds, edgeIds]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges as Edge[]);

  const rfInstance = useRef<ReactFlowInstance<AnyNode, Edge> | null>(null);
  const isFirstLayout = useRef(true);
  const [printing, setPrinting] = useState(false);

  // Sync layout; re-fit viewport when node set changes (e.g. second spouse added)
  useEffect(() => {
    setNodes(layoutNodes);
    if (!isFirstLayout.current) {
      const t = setTimeout(() => rfInstance.current?.fitView({ padding: 0.25, duration: 300 }), 50);
      return () => clearTimeout(t);
    }
    isFirstLayout.current = false;
  }, [layoutNodes, setNodes]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setEdges(rawEdges as Edge[]); }, [edgeIds]);

  async function handlePrint(paper: PaperSize) {
    setPrinting(true);
    try {
      await exportTreeToPdf({ nodes, paper, title });
    } catch {
      alert(t("printError"));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="w-full flex-1 min-h-[600px] rounded-xl border bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={(instance) => { rfInstance.current = instance; }}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="top-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={printing || nodes.length === 0}
                className="gap-1.5 bg-white"
              >
                {printing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {printing ? t("printing") : t("print")}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PAPER_SIZES.map((p) => (
                <DropdownMenuItem key={p} onClick={() => handlePrint(p)}>
                  {p}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Panel>
        <Background variant={BackgroundVariant.Dots} color="#cbd5e1" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "coupleNode") return "#fde68a";
            const g = (n.data as { person?: { gender?: string } })?.person?.gender;
            if (g === "male") return "#bfdbfe";
            if (g === "female") return "#fbcfe8";
            return "#fde68a";
          }}
          maskColor="rgba(248,250,252,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
```

> Note: `Button` uses Base UI's `render` prop convention in this repo, but shadcn's
> `DropdownMenuTrigger asChild` + `Button` is the exact pattern already used in
> `components/layout/Navbar.tsx` — follow it as written; it works here too.

- [ ] **Step 2: Pass the tree name from the tree page**

In `app/(dashboard)/trees/[treeId]/page.tsx`, line 583, change:
```tsx
        <FamilyTree nodes={nodes} edges={edges} />
```
to:
```tsx
        <FamilyTree nodes={nodes} edges={edges} title={treeMeta?.name} />
```
(`treeMeta` is the existing `useSWR<ITree>` result declared at line 134; `ITree.name` is a string.)

- [ ] **Step 3: Verify types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors in `FamilyTree.tsx` or the tree page. (Pre-existing `DashboardClient` set-state-in-effect lint error is unrelated.)

- [ ] **Step 4: Verify the build**

Run: `rm -rf .next && npm run build`
Expected: "✓ Compiled successfully". (Wipe `.next` first — this repo's dev/build cache corrupts if mixed.)

- [ ] **Step 5: Manual check**

Run: `npm run dev`. Open a tree with several people. Top-right of the canvas shows a **Print** button. Click it → menu **A4 / A3 / A2 / A1**:
- A4 → a PDF downloads named after the tree; the whole tree is visible, scaled to fit, with the tree name + date at the top; orientation matches the tree's shape.
- A3/A2/A1 → same tree, progressively larger (more readable) nodes.
- While generating, the button shows a spinner + "Preparing…".

- [ ] **Step 6: Commit**

```bash
git add "components/tree/FamilyTree.tsx" "app/(dashboard)/trees/[treeId]/page.tsx"
git commit -m "feat: print/export family tree to PDF (A4-A1) from canvas"
```

---

## Self-Review

**Spec coverage:**
- PDF download at A4/A3/A2/A1 → Task 1 (`exportTreeToPdf`, jsPDF `a1..a4`) + Task 3 (menu) ✓
- Whole tree, independent of pan/zoom → Task 1 (`getNodesBounds` + `getViewportForBounds`) ✓
- Single sheet, scale to fit → Task 1 (`computeFit`) ✓
- Auto orientation → Task 1 (`landscape = width >= height`) ✓
- Title + date → Task 1 (title branch) + Task 3 (`title={treeMeta?.name}`) ✓
- Capture viewport layer only → Task 1 (`.react-flow__viewport`) ✓
- New deps html-to-image + jspdf → Task 1 Step 1 ✓
- Print control in FamilyTree Panel, busy state, disabled when empty → Task 3 ✓
- i18n print/printing/printError in 3 locales → Task 2 ✓
- Errors (empty-tree, no-canvas, toPng fail) → Task 1 throws + Task 3 try/catch/finally ✓
- Raster cap for A1 → Task 1 (`MAX_PX`, `scale`) ✓

**Placeholder scan:** No TBD/TODO. Every code step shows full code. `computeFit` has a real failing-first test; DOM/PDF paths are explicitly manual (no fake test).

**Type consistency:** `PaperSize` defined in Task 1, imported in Task 3. `exportTreeToPdf({ nodes, paper, title })` signature matches the Task 3 call. `computeFit` signature matches its test. `title?: string` prop added in Task 3 and fed `treeMeta?.name` (`ITree.name: string`). `Node[]` param accepts the canvas's laid-out `nodes` (AnyNode extends Node).
