import dagre from "dagre";

const PERSON_W = 168;
const COUPLE_W = 380;
const POLY_COUPLE_W = 600;
const NODE_H = 90;
const NODESEP = 160;
const RANKSEP = 220;
const GAP = NODESEP; // horizontal gap between adjacent ancestor subtrees
const MIN_ROW_GAP = 64; // minimum horizontal space between two cards in the same generation row

type MinimalNode = { id: string; type?: string };
type MinimalEdge = { source: string; target: string; targetHandle?: string };

/**
 * Final overlap-resolution pass over the fan/dagre X positions.
 *
 * The pedigree fan places each anchor's ancestor cone independently and only
 * nudges whole anchor fans apart; where different ancestral lines converge on
 * shared or adjacent nodes, cards in the same generation row can end up
 * overlapping. This sweeps each row left→right and, whenever two cards are
 * closer than `minGap`, shifts the later card right by the shortfall — and
 * co-shifts that card's entire ancestor cone by the same delta so the cone
 * stays rigid (ancestors keep sitting above their descendant). All shifts are
 * rightward, so positions increase monotonically and the loop converges; it is
 * capped defensively. Returns the adjusted center-X map (does not mutate input).
 *
 * @param ids        node ids to place
 * @param centerX    current center-x per id (fan or dagre fallback)
 * @param y          row key per id (dagre generation Y)
 * @param width      node width by id
 * @param parentsOf  direct parents (ancestor edge) of a node — used to co-shift the cone
 * @param minGap     minimum gap between adjacent cards in a row
 */
export function enforceRowGaps(
  ids: string[],
  centerX: Map<string, number>,
  y: Map<string, number>,
  width: (id: string) => number,
  parentsOf: (id: string) => string[],
  minGap: number
): Map<string, number> {
  const cx = new Map(centerX);

  // Transitive ancestors of a node (its upward cone), cycle-guarded.
  const ancestorsCache = new Map<string, string[]>();
  function ancestorsOf(id: string): string[] {
    const cached = ancestorsCache.get(id);
    if (cached) return cached;
    const out: string[] = [];
    const seen = new Set<string>([id]);
    const stack = [...parentsOf(id)];
    while (stack.length) {
      const p = stack.pop()!;
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(p);
      for (const gp of parentsOf(p)) if (!seen.has(gp)) stack.push(gp);
    }
    ancestorsCache.set(id, out);
    return out;
  }

  function shiftCone(id: string, delta: number) {
    cx.set(id, (cx.get(id) ?? 0) + delta);
    for (const a of ancestorsOf(id)) cx.set(a, (cx.get(a) ?? 0) + delta);
  }

  // Group ids by row.
  const rows = new Map<number, string[]>();
  for (const id of ids) {
    if (!cx.has(id) || !y.has(id)) continue;
    const key = Math.round(y.get(id)!);
    (rows.get(key) ?? rows.set(key, []).get(key)!).push(id);
  }

  const cap = ids.length + 5;
  for (let pass = 0; pass < cap; pass++) {
    let moved = false;
    for (const row of rows.values()) {
      row.sort((a, b) => cx.get(a)! - cx.get(b)!);
      for (let i = 1; i < row.length; i++) {
        const prev = row[i - 1];
        const cur = row[i];
        const need = cx.get(prev)! + width(prev) / 2 + minGap + width(cur) / 2;
        if (cx.get(cur)! < need - 0.5) {
          shiftCone(cur, need - cx.get(cur)!);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  return cx;
}

function widthOfType(type?: string): number {
  return type === "polyCoupleNode" ? POLY_COUPLE_W : type === "coupleNode" ? COUPLE_W : PERSON_W;
}

/**
 * Layout strategy:
 *  - dagre lays out the whole graph → we keep its Y (generation rows) for every
 *    node, and its X only as a fallback for nodes the fan never reaches.
 *  - For the ancestor structure we override X with a per-couple pedigree fan:
 *    each couple's husband-side parent subtree goes to the right and the
 *    wife-side parent subtree to the left, recursively, with horizontal width
 *    allocated per subtree so nothing overlaps.
 *
 * Edges run parent→child (source = ancestor, target = descendant). For a couple
 * child the targetHandle starts with "person1" (wife / left card) or "person2"
 * (husband / right card).
 */
export function applyDagreLayout<T extends MinimalNode>(
  nodes: T[],
  edges: MinimalEdge[]
): T[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: RANKSEP, nodesep: NODESEP, marginx: 100, marginy: 100 });

  nodes.forEach((n) => {
    const w = n.type === "multiCoupleNode"
      ? ((n as { data?: { width?: number } }).data?.width ?? POLY_COUPLE_W)
      : widthOfType(n.type);
    g.setNode(n.id, { width: w, height: NODE_H });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  // dagre center positions: authoritative Y (generation rows) + fallback X
  const centerPos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => {
    const pos = g.node(n.id);
    if (pos?.x != null) centerPos.set(n.id, { x: pos.x, y: pos.y });
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const widthOfNode = (id: string): number => {
    const n = nodeById.get(id);
    if (n?.type === "multiCoupleNode") {
      const w = (n as { data?: { width?: number } }).data?.width;
      if (typeof w === "number" && w > 0) return w;
    }
    return widthOfType(n?.type);
  };
  const widthOf = widthOfNode;

  // Horizontal offset (from a node's centre) of the target handle a parent edge
  // lands on. Lets a lone/in-law parent sit above the correct spouse card of a
  // multi-spouse node instead of over the node centre.
  function handleOffsetX(targetId: string, th: string): number {
    const n = nodeById.get(targetId);
    const w = widthOf(targetId);
    if (n?.type === "polyCoupleNode") {
      const x = th === "left" ? 80 : th === "right" ? 520 : 300; // shared → 300
      return x - w / 2;
    }
    if (n?.type === "multiCoupleNode") {
      const m = /^spouse(\d+)$/.exec(th);
      const x = m ? 300 + 220 * Number(m[1]) : 80; // "shared" → 80
      return x - w / 2;
    }
    return 0;
  }

  // Resolve each child node's parents, split by side.
  // wife = person1 / left card, husband = person2 / right card.
  // singles = lone/in-law parent groups (no husband/wife split); a poly/multi
  // node can have several — one per spouse — each offset above its own card.
  type Parents = { wife?: string; husband?: string; singles?: { id: string; offset: number }[] };
  const parentsOf = new Map<string, Parents>();
  const hasChildren = new Set<string>(); // nodes that are a parent of someone
  edges.forEach((e) => {
    hasChildren.add(e.source);
    const entry = parentsOf.get(e.target) ?? {};
    const th = e.targetHandle ?? "";
    if (th.startsWith("person1")) entry.wife = e.source;
    else if (th.startsWith("person2")) entry.husband = e.source;
    else (entry.singles ??= []).push({ id: e.source, offset: handleOffsetX(e.target, th) });
    parentsOf.set(e.target, entry);
  });

  // Memoized horizontal extent of a node plus its entire ancestor fan.
  const widthMemo = new Map<string, number>();
  const widthVisiting = new Set<string>();
  function subtreeWidth(id: string): number {
    const cached = widthMemo.get(id);
    if (cached != null) return cached;
    if (widthVisiting.has(id)) return widthOf(id); // cycle / shared-ancestor guard
    widthVisiting.add(id);
    const p = parentsOf.get(id);
    const left = p?.wife ? subtreeWidth(p.wife) : 0;
    const right = p?.husband ? subtreeWidth(p.husband) : 0;
    let w = widthOf(id);
    if (p?.wife || p?.husband) w = Math.max(w, left + GAP + right);
    for (const s of p?.singles ?? []) w = Math.max(w, subtreeWidth(s.id));
    widthVisiting.delete(id);
    widthMemo.set(id, w);
    return w;
  }

  // Recursively place a node and its ancestor fan. X only; Y stays dagre's.
  const fanX = new Map<string, number>();
  function placeFan(id: string, centerX: number, visited: Set<string>) {
    if (visited.has(id)) return; // shared ancestor: place once (first path wins)
    visited.add(id);
    fanX.set(id, centerX);
    const p = parentsOf.get(id);
    if (p?.wife) placeFan(p.wife, centerX - GAP / 2 - subtreeWidth(p.wife) / 2, visited);
    if (p?.husband) placeFan(p.husband, centerX + GAP / 2 + subtreeWidth(p.husband) / 2, visited);
    // Lone/in-law parents: above their own spouse card (offset), not the node centre.
    for (const s of p?.singles ?? []) placeFan(s.id, centerX + s.offset, visited);
  }

  // Anchors = youngest nodes (never a parent). Fan upward from each, ordered by
  // dagre X, shifting right when a fan would overlap the previous one.
  const anchors = nodes
    .map((n) => n.id)
    .filter((id) => !hasChildren.has(id) && centerPos.has(id))
    .sort((a, b) => centerPos.get(a)!.x - centerPos.get(b)!.x);

  const visited = new Set<string>();
  let cursor = -Infinity; // right edge of the previously placed fan
  for (const anchorId of anchors) {
    const half = subtreeWidth(anchorId) / 2;
    let cx = centerPos.get(anchorId)!.x;
    if (cx - half < cursor) cx = cursor + half; // clear the previous fan
    placeFan(anchorId, cx, visited);
    cursor = cx + half + GAP;
  }

  // Resolve any remaining same-row overlaps (fan cones from different anchors can
  // still collide where ancestral lines converge). Fan-visited nodes use fanX; the
  // rest keep dagre X. Y is always dagre's.
  const placedIds = nodes.map((n) => n.id).filter((id) => centerPos.has(id));
  const centerXMap = new Map<string, number>();
  const yMap = new Map<string, number>();
  for (const id of placedIds) {
    centerXMap.set(id, fanX.get(id) ?? centerPos.get(id)!.x);
    yMap.set(id, centerPos.get(id)!.y);
  }
  const coneParents = (id: string): string[] => {
    const p = parentsOf.get(id);
    if (!p) return [];
    return [p.wife, p.husband, ...(p.singles?.map((s) => s.id) ?? [])].filter((v): v is string => !!v);
  };
  const adjustedX = enforceRowGaps(placedIds, centerXMap, yMap, widthOf, coneParents, MIN_ROW_GAP);

  // Convert to top-left for React Flow.
  return nodes.map((n) => {
    const pos = centerPos.get(n.id);
    const w = widthOf(n.id);
    if (!pos) return { ...n, position: { x: 0, y: 0 } };
    const cx = adjustedX.get(n.id) ?? fanX.get(n.id) ?? pos.x;
    return { ...n, position: { x: cx - w / 2, y: pos.y - NODE_H / 2 } };
  });
}
