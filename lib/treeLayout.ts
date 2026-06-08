import dagre from "dagre";

const PERSON_W = 168;
const COUPLE_W = 380;  // 160px card + 60px gap + 160px card
const NODE_H = 90;
const NODESEP = 60;

type MinimalNode = { id: string; type?: string };
type MinimalEdge = { source: string; target: string; targetHandle?: string };

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
    if (pos?.x != null) centerPos.set(n.id, { x: pos.x, y: pos.y });
  });

  // Build parent → children map
  const childrenMap = new Map<string, string[]>();
  edges.forEach((e) => {
    const kids = childrenMap.get(e.source) ?? [];
    kids.push(e.target);
    childrenMap.set(e.source, kids);
  });

  // Build id→node map for O(1) width lookup
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Reposition siblings top-down: ancestors have smaller Y, so processing top-down
  // ensures grandparent positions are finalized before grandchildren are centered
  const sortedParents = [...childrenMap.entries()].sort(
    ([a], [b]) => (centerPos.get(a)?.y ?? 0) - (centerPos.get(b)?.y ?? 0)
  );

  sortedParents.forEach(([parentId, childIds]) => {
    if (childIds.length < 2) return;
    const parentPos = centerPos.get(parentId);
    if (!parentPos) return;

    childIds.sort((a, b) => (centerPos.get(a)?.x ?? 0) - (centerPos.get(b)?.x ?? 0));

    const widths = childIds.map((id) => {
      const node = nodeById.get(id);
      return node?.type === "coupleNode" ? COUPLE_W : PERSON_W;
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

  // Position parents correctly above each child node.
  // Couple node: ordered [p1_father, p1_mother, +extra_gap, p2_father, p2_mother] centered above couple.
  // Person node: swap if father ended up right of mother.
  const parentEdgesByTarget = new Map<string, Array<{ source: string; handle?: string }>>();
  edges.forEach((e) => {
    const arr = parentEdgesByTarget.get(e.target) ?? [];
    arr.push({ source: e.source, handle: e.targetHandle });
    parentEdgesByTarget.set(e.target, arr);
  });

  parentEdgesByTarget.forEach((parentEdges, targetId) => {
    const targetNode = nodeById.get(targetId);
    const targetPos = centerPos.get(targetId);
    if (!targetNode || !targetPos) return;

    if (targetNode.type === "coupleNode") {
      const p1: string[] = [];
      const p2: string[] = [];
      parentEdges.forEach(({ source, handle }) => {
        if (!handle) return;
        if (handle.startsWith("person1"))
          handle.includes("father") ? p1.unshift(source) : p1.push(source);
        else if (handle.startsWith("person2"))
          handle.includes("father") ? p2.unshift(source) : p2.push(source);
      });

      const ordered = [...p1, ...p2];
      if (ordered.length === 0) return;

      const widths = ordered.map((id) =>
        nodeById.get(id)?.type === "coupleNode" ? COUPLE_W : PERSON_W
      );
      const extraGap = p1.length > 0 && p2.length > 0 ? NODESEP : 0;
      const totalWidth =
        widths.reduce((s, w) => s + w, 0) + NODESEP * (ordered.length - 1) + extraGap;

      let x = targetPos.x - totalWidth / 2;
      ordered.forEach((id, i) => {
        const cur = centerPos.get(id);
        if (cur) centerPos.set(id, { x: x + widths[i] / 2, y: cur.y });
        x += widths[i] + NODESEP;
        if (i === p1.length - 1 && p2.length > 0) x += extraGap;
      });
    } else {
      // PersonNode: swap if father ended up right of mother
      const father = parentEdges.find((pe) => pe.handle === "father")?.source;
      const mother = parentEdges.find((pe) => pe.handle === "mother")?.source;
      if (!father || !mother) return;
      const fp = centerPos.get(father);
      const mp = centerPos.get(mother);
      if (!fp || !mp || fp.x <= mp.x) return;
      centerPos.set(father, { x: mp.x, y: fp.y });
      centerPos.set(mother, { x: fp.x, y: mp.y });
    }
  });

  // Convert center positions to top-left for React Flow
  return nodes.map((n) => {
    const pos = centerPos.get(n.id);
    const w = n.type === "coupleNode" ? COUPLE_W : PERSON_W;
    if (!pos) return { ...n, position: { x: 0, y: 0 } };
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - NODE_H / 2 } };
  });
}
