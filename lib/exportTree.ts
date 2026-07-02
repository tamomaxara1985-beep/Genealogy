import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

export type PaperSize = "A4" | "A3" | "A2" | "A1";

const PAD = 40;       // graph-space padding around the tree
const MAX_PX = 4000;  // cap on the raster's longest side
const TITLE_MM = 14;  // vertical band reserved for the title + date

/**
 * Render the title + date to a PNG via a browser canvas so the PDF title
 * uses real system fonts (Georgian/Hebrew/etc), which jsPDF's built-in
 * Latin-only core font cannot display. Returns the data URL + pixel size.
 */
function renderTitlePng(
  title: string,
  subtitle: string
): { dataUrl: string; w: number; h: number } {
  const SCALE = 4;
  const titlePx = 34;
  const subPx = 18;
  const gap = 6;
  const padX = 24;
  const font1 = `600 ${titlePx}px Inter, Arial, sans-serif`;
  const font2 = `${subPx}px Inter, Arial, sans-serif`;

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font1;
  const w1 = measure.measureText(title).width;
  measure.font = font2;
  const w2 = measure.measureText(subtitle).width;

  const contentW = Math.max(w1, w2) + padX * 2;
  const contentH = titlePx + gap + subPx;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(contentW * SCALE);
  canvas.height = Math.ceil(contentH * SCALE);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#26332c";
  ctx.font = font1;
  ctx.fillText(title, contentW / 2, 0);
  ctx.fillStyle = "#6a6a72";
  ctx.font = font2;
  ctx.fillText(subtitle, contentW / 2, titlePx + gap);

  return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
}

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
  const titleH = title ? TITLE_MM : 0;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2 - titleH;

  const { drawW, drawH } = computeFit(imgW, imgH, availW, availH);
  const dx = (pageW - drawW) / 2;
  const dy = margin + titleH + (availH - drawH) / 2;

  if (title) {
    // Render the title band via a canvas (real fonts, Unicode-safe), then
    // fit it into the reserved band width without distortion.
    const banner = renderTitlePng(title, `Generated ${new Date().toLocaleDateString()}`);
    const fit = computeFit(banner.w, banner.h, availW, TITLE_MM);
    const tx = (pageW - fit.drawW) / 2;
    doc.addImage(banner.dataUrl, "PNG", tx, margin, fit.drawW, fit.drawH);
  }

  doc.addImage(dataUrl, "PNG", dx, dy, drawW, drawH);
  // Keep Unicode letters/numbers in the file name; collapse the rest to "_".
  const base = (title || "family-tree").replace(/[^\p{L}\p{N}._-]+/gu, "_");
  doc.save(`${base}.pdf`);
}
