import dagre from "dagre";

const PERSON_W = 168;
const COUPLE_W = 380;
const POLY_COUPLE_W = 600;
const NODE_H = 90;
const NODESEP = 160;
const RANKSEP = 220;

type MinimalNode = { id: string; type?: string };
type MinimalEdge = { source: string; target: string; targetHandle?: string };

// Logical left-to-right order of parent handle slots
const HANDLE_ORDER: Record<string, number> = {
  "person1-mother": 0,
  "mother": 0,
  "person1-father": 1,
  "father": 1,
  "person2-mother": 2,
  "person2-father": 3,
};

export function applyDagreLayout<T extends MinimalNode>(
  nodes: T[],
  edges: MinimalEdge[]
): T[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: RANKSEP, nodesep: NODESEP, marginx: 100, marginy: 100 });

  nodes.forEach((n) => {
    g.setNode(n.id, {
      width: n.type === "polyCoupleNode" ? POLY_COUPLE_W : n.type === "coupleNode" ? COUPLE_W : PERSON_W,
      height: NODE_H,
    });
  });

  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  // Capture dagre center positions
  const centerPos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => {
    const pos = g.node(n.id);
    if (pos?.x != null) centerPos.set(n.id, { x: pos.x, y: pos.y });
  });

  // Build id→node map for O(1) width lookup
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Build parent → children map for sibling repositioning
  const childrenMap = new Map<string, string[]>();
  edges.forEach((e) => {
    const kids = childrenMap.get(e.source) ?? [];
    kids.push(e.target);
    childrenMap.set(e.source, kids);
  });

  // Reposition siblings top-down so siblings are evenly spaced under their parent.
  // Process ancestors first (smaller Y) so grandparent positions are finalized
  // before grandchildren are centered.
  const sortedParents = [...childrenMap.entries()].sort(
    ([a], [b]) => (centerPos.get(a)?.y ?? 0) - (centerPos.get(b)?.y ?? 0)
  );

  sortedParents.forEach(([parentId, childIds]) => {
    if (childIds.length < 2) return;
    const parentPos = centerPos.get(parentId);
    if (!parentPos) return;

    childIds.sort((a, b) => (centerPos.get(a)?.x ?? 0) - (centerPos.get(b)?.x ?? 0));

    const widths = childIds.map((id) => {
      const t = nodeById.get(id)?.type;
      return t === "polyCoupleNode" ? POLY_COUPLE_W : t === "coupleNode" ? COUPLE_W : PERSON_W;
    });

    const totalWidth =
      widths.reduce((sum, w) => sum + w, 0) + NODESEP * (childIds.length - 1);
    let x = parentPos.x - totalWidth / 2;

    childIds.forEach((id, i) => {
      const cur = centerPos.get(id);
      if (cur) centerPos.set(id, { x: x + widths[i] / 2, y: cur.y });
      x += widths[i] + NODESEP;
    });
  });

  // Enforce father-left / mother-right ordering without moving nodes.
  // For each child, collect its parents grouped by handle, sort them by
  // logical order (person1-father < person1-mother < person2-father < person2-mother),
  // then reassign their current X positions in ascending order to that sequence.
  // Dagre's spacing is preserved — only ordering is corrected.
  const parentsByTarget = new Map<string, Array<{ source: string; order: number }>>();
  edges.forEach((e) => {
    if (!e.targetHandle || HANDLE_ORDER[e.targetHandle] === undefined) return;
    const list = parentsByTarget.get(e.target) ?? [];
    list.push({ source: e.source, order: HANDLE_ORDER[e.targetHandle] });
    parentsByTarget.set(e.target, list);
  });

  parentsByTarget.forEach((parents) => {
    if (parents.length < 2) return;
    parents.sort((a, b) => a.order - b.order);
    const xs = parents
      .map((p) => centerPos.get(p.source)?.x)
      .filter((x): x is number => x !== undefined);
    if (xs.length !== parents.length) return;
    const sortedXs = [...xs].sort((a, b) => a - b);
    parents.forEach((p, i) => {
      const cur = centerPos.get(p.source);
      if (cur) centerPos.set(p.source, { x: sortedXs[i], y: cur.y });
    });
  });

  // Convert center positions to top-left for React Flow
  return nodes.map((n) => {
    const pos = centerPos.get(n.id);
    const w = n.type === "polyCoupleNode" ? POLY_COUPLE_W : n.type === "coupleNode" ? COUPLE_W : PERSON_W;
    if (!pos) return { ...n, position: { x: 0, y: 0 } };
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - NODE_H / 2 } };
  });
}
