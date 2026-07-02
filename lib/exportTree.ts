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
