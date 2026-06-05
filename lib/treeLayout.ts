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
