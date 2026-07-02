# Family Tree Print / Export to PDF (A4–A1)

**Date:** 2026-07-02
**Status:** Approved design, pending implementation plan

## Problem

Users want to print or save their family tree as a PDF on standard poster paper
sizes: **A4, A3, A2, A1**. The tree renders on a React Flow canvas
(`components/tree/FamilyTree.tsx`). There is no export/print feature today and no
PDF/image libraries installed.

## Decisions (from brainstorming)

- **Output:** download a PDF sized exactly to the chosen A-paper (not the browser
  print dialog).
- **Content:** the *whole* tree — every node currently rendered (respecting the
  page's collapse/filter state) — scaled to fit, independent of the current
  pan/zoom.
- **Fit:** always a single sheet; the whole tree scales to fit. Larger paper
  (A2/A1) → larger, more readable nodes.
- **Orientation:** automatic — landscape when the tree's bounds are wider than
  tall, otherwise portrait.
- **Title:** the tree name centered at the top, with a small "Generated
  <date>" line; both optional (omitted if no title supplied).

## Non-Goals (YAGNI)

- No tiling a large tree across multiple sheets.
- No server-side rendering (puppeteer) — fully client-side.
- No custom margins/DPI UI, no page-range, no per-node pagination.
- No PNG/SVG export (PDF only). No print-preview screen.

## Architecture

Fully client-side. One capture → one raster → one PDF.

```
Print menu (A4/A3/A2/A1)  →  exportTreeToPdf({ nodes, paper, title })
   getNodesBounds(nodes)              // full-graph bounding box
   getViewportForBounds(...)          // transform that fits the WHOLE tree
   toPng('.react-flow__viewport')     // raster of nodes+edges only
   jsPDF(format, orientation)         // A-sized page, image scaled-to-fit
   doc.save('<tree>.pdf')
```

Why `.react-flow__viewport`: Background dots, `<Controls>`, and `<MiniMap>` are
sibling layers *outside* the viewport element, so capturing the viewport yields a
clean tree (nodes + edges) with none of the canvas chrome.

## New dependencies

- `html-to-image` — `toPng` DOM-to-PNG rasterizer.
- `jspdf` — client-side PDF builder (supports `format: 'a1'..'a4'`, orientation).

Both are client-only; no server or native dependency.

## Component: `lib/exportTree.ts`

```ts
import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react"
import { toPng } from "html-to-image"
import { jsPDF } from "jspdf"

export type PaperSize = "A4" | "A3" | "A2" | "A1"

interface ExportArgs {
  nodes: Node[]        // laid-out nodes (with positions) from the canvas
  paper: PaperSize
  title?: string       // tree name; also the file name base
}

export async function exportTreeToPdf({ nodes, paper, title }: ExportArgs): Promise<void>
```

Behavior:

1. If `nodes.length === 0` → throw `Error("empty-tree")` (caller disables the
   button, but guard anyway).
2. `const bounds = getNodesBounds(nodes)` → `{ x, y, width, height }`.
3. Compute raster size with padding and a hard cap so A1 never exceeds browser
   canvas limits:
   - `PAD = 40` (px, in graph space)
   - `rawW = bounds.width + PAD*2`, `rawH = bounds.height + PAD*2`
   - `MAX_PX = 4000`; `scale = Math.min(2, MAX_PX / Math.max(rawW, rawH))`
   - `imgW = Math.round(rawW * scale)`, `imgH = Math.round(rawH * scale)`
4. `const { x, y, zoom } = getViewportForBounds(bounds, imgW, imgH, 0.1, 2, 0.1)`
   (minZoom 0.1, maxZoom 2, padding 0.1 — matches the canvas zoom limits).
5. `const el = document.querySelector<HTMLElement>(".react-flow__viewport")`;
   if missing → throw `Error("no-canvas")`.
6. `const dataUrl = await toPng(el, { backgroundColor: "#ffffff", width: imgW,`
   `height: imgH, pixelRatio: 1, style: { width: `${imgW}px`, height: `${imgH}px`,`
   `transform: `translate(${x}px, ${y}px) scale(${zoom})` } })`.
7. Build the PDF:
   - `const landscape = bounds.width >= bounds.height`
   - `const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait",`
     `unit: "mm", format: paper.toLowerCase() })`
   - `const pageW = doc.internal.pageSize.getWidth()`, `pageH = ...getHeight()`
   - `const margin = 10`, `titleH = title ? 12 : 0`
   - `availW = pageW - margin*2`, `availH = pageH - margin - margin - titleH`
   - Fit image AR into `availW × availH`, centered:
     `imgAR = imgW/imgH`; `drawW = availW; drawH = drawW/imgAR;`
     `if (drawH > availH) { drawH = availH; drawW = drawH*imgAR }`
     `dx = (pageW - drawW)/2; dy = margin + titleH + (availH - drawH)/2`
   - If `title`: `doc.setFontSize(16); doc.text(title, pageW/2, margin+7,`
     `{ align: "center" })`; `doc.setFontSize(9); doc.setTextColor(120);`
     `doc.text(\`Generated ${new Date().toLocaleDateString()}\`, pageW/2,`
     `margin+12, { align: "center" })`.
   - `doc.addImage(dataUrl, "PNG", dx, dy, drawW, drawH)`
   - `doc.save(\`${(title || "family-tree").replace(/[^\w.-]+/g, "_")}.pdf\`)`

Paper sizes are delegated to jsPDF's built-in `a1..a4` formats (portrait mm:
A4 210×297, A3 297×420, A2 420×594, A1 594×841); orientation flips W/H.

## UI: print control in `FamilyTree.tsx`

`rfInstance` and the laid-out `nodes` already live in `FamilyTree`, so the control
goes there (no ref plumbing to `TreeToolbar`).

- Add `Panel` to the `@xyflow/react` import; render `<Panel position="top-right">`
  inside `<ReactFlow>`.
- Add prop `title?: string` to `FamilyTree` `Props`; the tree page passes the
  tree name.
- The panel holds a shadcn `DropdownMenu`: trigger = a `Button` (outline, size sm)
  labeled `t("print")` with a `Printer` lucide icon and a chevron; items = `A4`,
  `A3`, `A2`, `A1` (literal labels, no translation).
- Local state `const [busy, setBusy] = useState(false)`.
- On item click:
  ```
  setBusy(true)
  try { await exportTreeToPdf({ nodes, paper, title }) }
  catch { alert(t("printError")) }
  finally { setBusy(false) }
  ```
- Trigger button: `disabled={busy || nodes.length === 0}`; while `busy`, show
  `t("printing")` + a spinning `Loader2`.

## i18n

Add to `messages/en.json`, `ka.json`, `he.json` under the `tree` namespace
(size labels A4–A1 are universal, not translated):

| key | en | ka | he |
|-----|----|----|----|
| `print` | Print | ბეჭდვა | הדפסה |
| `printing` | Preparing… | მზადდება… | מכין… |
| `printError` | Could not generate the PDF. Please try again. | PDF ვერ შეიქმნა. სცადეთ თავიდან. | לא ניתן ליצור PDF. נסו שוב. |

## Error handling

- Empty tree → trigger disabled; `exportTreeToPdf` also throws `empty-tree`.
- Missing `.react-flow__viewport` → throws `no-canvas`; caught → `printError` alert.
- `toPng` rejection (e.g. tainted canvas) → caught → `printError` alert; `busy`
  always cleared in `finally`.

## Files Touched

| File | Change |
|------|--------|
| `package.json` | add `html-to-image`, `jspdf` deps |
| `lib/exportTree.ts` | new — `exportTreeToPdf` + `PaperSize` |
| `components/tree/FamilyTree.tsx` | add `Panel` print menu, `title` prop, busy state |
| `app/(dashboard)/trees/[treeId]/page.tsx` | pass `title={tree name}` to `<FamilyTree>` |
| `messages/en.json`, `ka.json`, `he.json` | `tree.print`, `tree.printing`, `tree.printError` |

## Testing

- No unit test runner fit for DOM raster/PDF; verify manually.
- Manual (`npm run dev`): open a tree with several people → **Print → A4**: a PDF
  downloads, whole tree visible, fit to page, portrait/landscape auto by shape,
  title + date at top. Repeat A3/A2/A1 → same tree, progressively larger nodes.
- Empty tree (no persons): the tree page already hides `<FamilyTree>` when
  `persons.length === 0`, so the control isn't reachable; the internal guard
  covers the defensive case.
- `npm run build` + `npm test` (existing suite) stay green.
