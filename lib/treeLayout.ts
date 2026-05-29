import dagre from "dagre";

const PERSON_W = 168;
const PERSON_H = 90;
const COUPLE_W = 200;
const COUPLE_H = 90;
const NODE_H = 90;

type MinimalNode = { id: string; type?: string };
type MinimalEdge = { source: string; target: string };

export function applyDagreLayout<T extends MinimalNode>(
  nodes: T[],
  edges: MinimalEdge[]
): T[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 130, nodesep: 60, marginx: 60, marginy: 60 });

  nodes.forEach((n) => {
    const isCouple = n.type === "coupleNode";
    g.setNode(n.id, {
      width: isCouple ? COUPLE_W : PERSON_W,
      height: NODE_H,
    });
  });

  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    const w = n.type === "coupleNode" ? COUPLE_W : PERSON_W;
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - NODE_H / 2 } };
  });
}
