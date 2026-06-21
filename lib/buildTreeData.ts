import type { IPerson, IRelationship, RelativeRole, TreeEdge } from "@/types";
import type { PersonNodeType } from "@/components/tree/PersonNode";
import type { CoupleNodeType } from "@/components/tree/CoupleNode";

type AnyNode = PersonNodeType | CoupleNodeType;

interface Callbacks {
  onAddRelative: (personId: string, role: RelativeRole) => void;
  onSelect: (person: IPerson) => void;
  onToggleCollapse?: (personId: string) => void;
  collapsedPersonIds?: Set<string>;
}

export function buildTreeData(
  persons: IPerson[],
  relationships: IRelationship[],
  callbacks: Callbacks,
  highlighted: Set<string>
): { nodes: AnyNode[]; edges: TreeEdge[] } {
  const hasFilter = highlighted.size > 0;

  const spouseRels = relationships.filter((r) => r.type === "spouse");
  const parentChildRels = relationships.filter((r) => r.type === "parent-child");

  // Build couple groupings — every spouse relationship gets its own CoupleNode.
  const personInAnyCouple = new Set<string>();
  const coupleByPair = new Map<string, string>();      // "p1Id|p2Id" → coupleNodeId (both orderings stored)
  const couplesByPerson = new Map<string, string[]>(); // personId → [coupleNodeId, ...]
  const coupleSlot = new Map<string, 1 | 2>();         // personId → slot (1=left/male, 2=right/female; gender-determined)

  const coupleNodes: CoupleNodeType[] = [];

  spouseRels.forEach((r) => {
    let p1 = persons.find((p) => p._id === r.person1Id);
    let p2 = persons.find((p) => p._id === r.person2Id);
    if (!p1 || !p2) return;

    // Male (father) always on left (slot 1), female (mother) always on right (slot 2)
    if (p1.gender === "female" && p2.gender === "male") [p1, p2] = [p2, p1];

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
        style: dim
          ? { opacity: 0.25, transition: "opacity 0.2s" }
          : { opacity: 1 },
        data: {
          person: p,
          onAddRelative: callbacks.onAddRelative,
          onSelect: callbacks.onSelect,
          onToggleCollapse: callbacks.onToggleCollapse,
          isCollapsed: callbacks.collapsedPersonIds?.has(p._id) ?? false,
        },
      } as PersonNodeType;
    });

  // Build parents-per-child map so sourceNodeId can find co-parents.
  const parentsByChild = new Map<string, string[]>();
  parentChildRels.forEach((r) => {
    const arr = parentsByChild.get(r.person2Id) ?? [];
    arr.push(r.person1Id);
    parentsByChild.set(r.person2Id, arr);
  });

  // Return the node ID that represents parentId as a source for an edge to childId.
  // Finds the CoupleNode that contains parentId and any co-parent of childId.
  // Falls back to the parent's first CoupleNode, then the bare personId.
  function sourceNodeId(parentId: string, childId: string): string {
    for (const otherId of (parentsByChild.get(childId) ?? [])) {
      if (otherId === parentId) continue;
      const coupleId = coupleByPair.get(`${parentId}|${otherId}`);
      if (coupleId) return coupleId;
    }
    return couplesByPerson.get(parentId)?.[0] ?? parentId;
  }

  // Build edges (parent-child only; spouse edges are implicit in couple nodes)
  const seenEdges = new Set<string>();
  const edges: TreeEdge[] = [];

  parentChildRels.forEach((r) => {
    const source = sourceNodeId(r.person1Id, r.person2Id);
    const target = couplesByPerson.get(r.person2Id)?.[0] ?? r.person2Id;
    if (source === target) return; // same couple node — skip

    const key = `${source}->${target}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);

    const parentPerson = persons.find((p) => p._id === r.person1Id);
    const isMother = parentPerson?.gender === "female";
    const childSlot = coupleSlot.get(r.person2Id);
    const targetHandle = childSlot
      ? `${childSlot === 1 ? "person1" : "person2"}-${isMother ? "mother" : "father"}`
      : isMother ? "mother" : "father";

    edges.push({
      id: r._id,
      source,
      target,
      type: "smoothstep",
      label: undefined,
      targetHandle,
    });
  });

  const nodes: AnyNode[] = [...coupleNodes, ...personNodes];
  return { nodes, edges };
}
