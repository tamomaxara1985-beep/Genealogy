import type { IPerson, IRelationship, RelativeRole, TreeEdge } from "@/types";
import type { PersonNodeType } from "@/components/tree/PersonNode";
import type { CoupleNodeType } from "@/components/tree/CoupleNode";
import type { PolyCoupleNodeType } from "@/components/tree/PolyCoupleNode";

type AnyNode = PersonNodeType | CoupleNodeType | PolyCoupleNodeType;

interface Callbacks {
  onAddRelative?: (personId: string, role: RelativeRole, personId2?: string) => void;
  onSelect: (person: IPerson) => void;
  onToggleCollapse?: (personId: string) => void;
  collapsedPersonIds?: Set<string>;
  rootPersonId?: string | null;
  rootSiblingCount?: number;
  rootSiblingsExpanded?: boolean;
  onToggleRootSiblings?: () => void;
}

export function buildTreeData(
  persons: IPerson[],
  relationships: IRelationship[],
  callbacks: Callbacks,
  highlighted: Set<string>
): { nodes: AnyNode[]; edges: TreeEdge[] } {
  const hasFilter = highlighted.size > 0;

  const hasRootBadge = (callbacks.rootSiblingCount ?? 0) > 0;
  const isRootPerson = (id: string) =>
    hasRootBadge && callbacks.rootPersonId === id;

  const spouseRels = relationships.filter((r) => r.type === "spouse");
  const parentChildRels = relationships.filter((r) => r.type === "parent-child");

  const personInAnyCouple = new Set<string>();
  const coupleByPair = new Map<string, string>();      // "p1|p2" → coupleNodeId (regular couples only)
  const couplesByPerson = new Map<string, string[]>(); // personId → [nodeId]
  const coupleSlot = new Map<string, 1 | 2>();         // regular CoupleNode slot

  // Poly-couple routing (person with exactly 2 spouses → polyCoupleNode)
  const polyByPair = new Map<string, { nodeId: string; handle: "left" | "right" }>();
  const polyTargetSlot = new Map<string, "left" | "shared" | "right">();

  const coupleNodes: CoupleNodeType[] = [];
  const polyCoupleNodes: PolyCoupleNodeType[] = [];

  // Group spouse rels per person to detect poly-couples
  const spouseRelsByPerson = new Map<string, IRelationship[]>();
  spouseRels.forEach((r) => {
    for (const id of [r.person1Id, r.person2Id]) {
      const arr = spouseRelsByPerson.get(id) ?? [];
      arr.push(r);
      spouseRelsByPerson.set(id, arr);
    }
  });

  // Process persons with exactly 2 spouse rels → polyCoupleNode
  // Sort males first so a husband-with-2-wives scenario centres on the husband,
  // not on a wife who also happens to have a previous marriage.
  const processedRelIds = new Set<string>();
  const polyEntries = [...spouseRelsByPerson.entries()].sort(([aId], [bId]) => {
    const ag = persons.find((p) => p._id === aId)?.gender;
    const bg = persons.find((p) => p._id === bId)?.gender;
    if (ag === "male" && bg !== "male") return -1;
    if (bg === "male" && ag !== "male") return 1;
    return 0;
  });

  for (const [sharedId, rels] of polyEntries) {
    // Skip if already committed to another polyCoupleNode as a spouse
    if (personInAnyCouple.has(sharedId)) continue;
    if (rels.some((r) => processedRelIds.has(r._id))) continue;

    // Deduplicate by spouse ID (guards against duplicate DB rels)
    const seenSpouses = new Map<string, IRelationship>();
    for (const r of rels) {
      const spId = r.person1Id === sharedId ? r.person2Id : r.person1Id;
      if (!seenSpouses.has(spId)) seenSpouses.set(spId, r);
    }
    if (seenSpouses.size !== 2) continue;

    const [[sp1Id, rel1], [sp2Id, rel2]] = [...seenSpouses.entries()];

    const shared = persons.find((p) => p._id === sharedId);
    const sp1 = persons.find((p) => p._id === sp1Id);
    const sp2 = persons.find((p) => p._id === sp2Id);

    if (!shared || !sp1 || !sp2) continue;
    // Skip if either spouse is already in another polyCoupleNode
    if (personInAnyCouple.has(sp1Id) || personInAnyCouple.has(sp2Id)) continue;

    // Mark all rels for both spouse pairs as processed (handles DB duplicates)
    rels.forEach((r) => processedRelIds.add(r._id));

    personInAnyCouple.add(sharedId);
    personInAnyCouple.add(sp1Id);
    personInAnyCouple.add(sp2Id);

    const polyId = `poly_${sharedId}`;

    polyByPair.set(`${sp1Id}|${sharedId}`, { nodeId: polyId, handle: "left" });
    polyByPair.set(`${sharedId}|${sp1Id}`, { nodeId: polyId, handle: "left" });
    polyByPair.set(`${sp2Id}|${sharedId}`, { nodeId: polyId, handle: "right" });
    polyByPair.set(`${sharedId}|${sp2Id}`, { nodeId: polyId, handle: "right" });

    couplesByPerson.set(sharedId, [polyId]);
    couplesByPerson.set(sp1Id, [polyId]);
    couplesByPerson.set(sp2Id, [polyId]);

    polyTargetSlot.set(sp1Id, "left");
    polyTargetSlot.set(sharedId, "shared");
    polyTargetSlot.set(sp2Id, "right");

    const dim =
      hasFilter &&
      !highlighted.has(sharedId) &&
      !highlighted.has(sp1Id) &&
      !highlighted.has(sp2Id);

    polyCoupleNodes.push({
      id: polyId,
      type: "polyCoupleNode",
      position: { x: 0, y: 0 },
      style: dim ? { opacity: 0.25, transition: "opacity 0.2s" } : { opacity: 1 },
      data: {
        leftSpouse: sp1,
        shared,
        rightSpouse: sp2,
        isDivorced1: !!rel1.endDate,
        divorceDate1: rel1.endDate,
        isDivorced2: !!rel2.endDate,
        divorceDate2: rel2.endDate,
        onAddRelative: callbacks.onAddRelative,
        onSelect: callbacks.onSelect,
        rootSlot: isRootPerson(sp1Id)
          ? "left"
          : isRootPerson(sharedId)
          ? "shared"
          : isRootPerson(sp2Id)
          ? "right"
          : undefined,
        rootSiblingCount:
          isRootPerson(sp1Id) || isRootPerson(sharedId) || isRootPerson(sp2Id)
            ? callbacks.rootSiblingCount
            : undefined,
        rootSiblingsExpanded: callbacks.rootSiblingsExpanded,
        onToggleRootSiblings: callbacks.onToggleRootSiblings,
      },
    } as PolyCoupleNodeType);
  }

  // Process remaining (single) spouse relationships → coupleNode
  // Skip rels where either person is already committed to a polyCoupleNode.
  spouseRels
    .filter((r) => !processedRelIds.has(r._id))
    .forEach((r) => {
      let p1 = persons.find((p) => p._id === r.person1Id);
      let p2 = persons.find((p) => p._id === r.person2Id);
      if (!p1 || !p2) return;
      // Skip if either person already appears in a polyCoupleNode
      if (personInAnyCouple.has(p1._id) || personInAnyCouple.has(p2._id)) return;

      if (p1.gender === "male" && p2.gender === "female") [p1, p2] = [p2, p1];

      personInAnyCouple.add(p1._id);
      personInAnyCouple.add(p2._id);

      const coupleId = `couple_${r._id}`;
      coupleByPair.set(`${p1._id}|${p2._id}`, coupleId);
      coupleByPair.set(`${p2._id}|${p1._id}`, coupleId);
      couplesByPerson.set(p1._id, [...(couplesByPerson.get(p1._id) ?? []), coupleId]);
      couplesByPerson.set(p2._id, [...(couplesByPerson.get(p2._id) ?? []), coupleId]);
      coupleSlot.set(p1._id, 1);
      coupleSlot.set(p2._id, 2);

      const dim =
        hasFilter && !highlighted.has(r.person1Id) && !highlighted.has(r.person2Id);

      coupleNodes.push({
        id: coupleId,
        type: "coupleNode",
        position: { x: 0, y: 0 },
        style: dim ? { opacity: 0.25, transition: "opacity 0.2s" } : { opacity: 1 },
        data: {
          person1: p1,
          person2: p2,
          onAddRelative: callbacks.onAddRelative,
          onSelect: callbacks.onSelect,
          isDivorced: !!r.endDate,
          divorceDate: r.endDate,
          onToggleCollapse: callbacks.onToggleCollapse,
          isCollapsed1: callbacks.collapsedPersonIds?.has(p1._id) ?? false,
          isCollapsed2: callbacks.collapsedPersonIds?.has(p2._id) ?? false,
          rootSlot: isRootPerson(p1._id) ? 1 : isRootPerson(p2._id) ? 2 : undefined,
          rootSiblingCount:
            isRootPerson(p1._id) || isRootPerson(p2._id)
              ? callbacks.rootSiblingCount
              : undefined,
          rootSiblingsExpanded: callbacks.rootSiblingsExpanded,
          onToggleRootSiblings: callbacks.onToggleRootSiblings,
        },
      } as CoupleNodeType);
    });

  // Individual person nodes (not in any couple)
  const personNodes: PersonNodeType[] = persons
    .filter((p) => !personInAnyCouple.has(p._id))
    .map((p) => {
      const dim = hasFilter && !highlighted.has(p._id);
      return {
        id: p._id,
        type: "personNode",
        position: { x: 0, y: 0 },
        style: dim ? { opacity: 0.25, transition: "opacity 0.2s" } : { opacity: 1 },
        data: {
          person: p,
          onAddRelative: callbacks.onAddRelative,
          onSelect: callbacks.onSelect,
          onToggleCollapse: callbacks.onToggleCollapse,
          isCollapsed: callbacks.collapsedPersonIds?.has(p._id) ?? false,
          isRoot: isRootPerson(p._id),
          rootSiblingCount: isRootPerson(p._id) ? callbacks.rootSiblingCount : undefined,
          rootSiblingsExpanded: isRootPerson(p._id) ? callbacks.rootSiblingsExpanded : undefined,
          onToggleRootSiblings: isRootPerson(p._id) ? callbacks.onToggleRootSiblings : undefined,
        },
      } as PersonNodeType;
    });

  // parents-per-child map for edge routing
  const parentsByChild = new Map<string, string[]>();
  parentChildRels.forEach((r) => {
    const arr = parentsByChild.get(r.person2Id) ?? [];
    arr.push(r.person1Id);
    parentsByChild.set(r.person2Id, arr);
  });

  // Find the source node + handle for a parent→child edge
  function sourceInfo(parentId: string, childId: string): { nodeId: string; handle?: string } {
    for (const otherId of (parentsByChild.get(childId) ?? [])) {
      if (otherId === parentId) continue;
      const polyRef = polyByPair.get(`${parentId}|${otherId}`);
      if (polyRef) return { nodeId: polyRef.nodeId, handle: polyRef.handle };
      const coupleId = coupleByPair.get(`${parentId}|${otherId}`);
      if (coupleId) return { nodeId: coupleId };
    }
    const first = couplesByPerson.get(parentId)?.[0] ?? parentId;
    if (first.startsWith("poly_")) return { nodeId: first, handle: "left" };
    return { nodeId: first };
  }

  const seenEdges = new Set<string>();
  const edges: TreeEdge[] = [];

  parentChildRels.forEach((r) => {
    const src = sourceInfo(r.person1Id, r.person2Id);
    const source = src.nodeId;
    const sourceHandle = src.handle;
    const target = couplesByPerson.get(r.person2Id)?.[0] ?? r.person2Id;
    if (source === target) return;

    const key = `${source}:${sourceHandle ?? ""}->${target}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);

    const parentPerson = persons.find((p) => p._id === r.person1Id);
    const isMother = parentPerson?.gender === "female";

    const polySlot = polyTargetSlot.get(r.person2Id);
    const cSlot = coupleSlot.get(r.person2Id);
    let targetHandle: string | undefined;
    if (polySlot) {
      targetHandle = `${polySlot}-${isMother ? "mother" : "father"}`;
    } else if (cSlot) {
      targetHandle = `${cSlot === 1 ? "person1" : "person2"}-${isMother ? "mother" : "father"}`;
    } else {
      targetHandle = isMother ? "mother" : "father";
    }

    edges.push({
      id: r._id,
      source,
      sourceHandle,
      target,
      type: "smoothstep",
      label: undefined,
      targetHandle,
    });
  });

  const nodes: AnyNode[] = [...coupleNodes, ...polyCoupleNodes, ...personNodes];

  return { nodes, edges };
}
