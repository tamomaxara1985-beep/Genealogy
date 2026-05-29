import dagre from "dagre";
import type { TreeNode, TreeEdge } from "@/types";

const NODE_W = 168;
const NODE_H = 90;

export function applyDagreLayout(
  nodes: TreeNode[],
  edges: TreeEdge[]
): TreeNode[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 120, nodesep: 80, marginx: 40, marginy: 40 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));

  // Only use parent-child edges for layout; spouse edges kept visual only
  edges
    .filter((e) => e.label !== "spouse")
    .forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    // Dagre centres nodes; shift to top-left origin for React Flow
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}
