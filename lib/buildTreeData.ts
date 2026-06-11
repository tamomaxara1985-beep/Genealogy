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

  // Build couple groupings (only first spouse pairing per person)
  const usedInCouple = new Set<string>();
  const coupleByPersonId = new Map<string, string>(); // personId → coupleNodeId
  const coupleSlot = new Map<string, 1 | 2>();         // personId → slot in couple (1=left, 2=right)

  const coupleNodes: CoupleNodeType[] = [];

  spouseRels.forEach((r) => {
    if (usedInCouple.has(r.person1Id) || usedInCouple.has(r.person2Id)) return;
    let p1 = persons.find((p) => p._id === r.person1Id);
    let p2 = persons.find((p) => p._id === r.person2Id);
    if (!p1 || !p2) return;

    // Male (father) always on left (slot 1), female (mother) always on right (slot 2)
    if (p1.gender === "female" && p2.gender === "male") [p1, p2] = [p2, p1];

    usedInCouple.add(r.person1Id);
    usedInCouple.add(r.person2Id);

    const coupleId = `couple_${r._id}`;
    coupleByPersonId.set(p1._id, coupleId);
    coupleByPersonId.set(p2._id, coupleId);
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

  // Individual person nodes (no spouse)
  const personNodes: PersonNodeType[] = persons
    .filter((p) => !usedInCouple.has(p._id))
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

  // Map personId → the node ID that represents them
  function nodeId(personId: string): string {
    return coupleByPersonId.get(personId) ?? personId;
  }

  // Build edges (parent-child only; spouse edges are implicit in couple nodes)
  const seenEdges = new Set<string>();
  const edges: TreeEdge[] = [];

  parentChildRels.forEach((r) => {
    const source = nodeId(r.person1Id);
    const target = nodeId(r.person2Id);
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
