import type { IPerson, IRelationship } from "@/types";

// BFS upward from seedId through parent-child edges. Excludes seedId.
function ancestorsOf(seedId: string, parentChildRels: IRelationship[]): Set<string> {
  const result = new Set<string>();
  const queue = [seedId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const r of parentChildRels) {
      if (r.person2Id === cur && !result.has(r.person1Id) && r.person1Id !== seedId) {
        result.add(r.person1Id);
        queue.push(r.person1Id);
      }
    }
  }
  return result;
}

/**
 * Partition the root couple's ancestry into right (male-side) and left
 * (female-side) person-id sets. Shared ancestors (reachable from both) are
 * removed from both. Returns empty sets when the root cannot be resolved.
 */
export function partitionRootAncestors(
  rootPersonId: string | null,
  persons: IPerson[],
  relationships: IRelationship[]
): { rightPersonIds: Set<string>; leftPersonIds: Set<string> } {
  const empty = { rightPersonIds: new Set<string>(), leftPersonIds: new Set<string>() };
  if (!rootPersonId) return empty;
  const byId = new Map(persons.map((p) => [p._id, p]));
  const root = byId.get(rootPersonId);
  if (!root) return empty;

  const parentChildRels = relationships.filter((r) => r.type === "parent-child");

  let rightPersonIds: Set<string>;
  let leftPersonIds: Set<string>;

  const spouseRel = relationships.find(
    (r) =>
      r.type === "spouse" &&
      (r.person1Id === rootPersonId || r.person2Id === rootPersonId)
  );

  if (spouseRel) {
    // Couple root: sides = each partner's ancestors, by gender.
    const spouseId =
      spouseRel.person1Id === rootPersonId ? spouseRel.person2Id : spouseRel.person1Id;
    const spouseGender = byId.get(spouseId)?.gender;
    let rightSeed: string;
    let leftSeed: string;
    if (root.gender === "male") { rightSeed = rootPersonId; leftSeed = spouseId; }
    else if (root.gender === "female") { leftSeed = rootPersonId; rightSeed = spouseId; }
    else if (spouseGender === "male") { rightSeed = spouseId; leftSeed = rootPersonId; }
    else if (spouseGender === "female") { leftSeed = spouseId; rightSeed = rootPersonId; }
    else { rightSeed = spouseId; leftSeed = rootPersonId; } // same/unknown fallback
    rightPersonIds = ancestorsOf(rightSeed, parentChildRels);
    leftPersonIds = ancestorsOf(leftSeed, parentChildRels);
  } else {
    // Single root: father's line right, mother's line left (seed + its ancestors).
    rightPersonIds = new Set<string>();
    leftPersonIds = new Set<string>();
    for (const r of parentChildRels) {
      if (r.person2Id !== rootPersonId) continue;
      const parent = byId.get(r.person1Id);
      if (!parent) continue;
      if (parent.gender === "male") {
        rightPersonIds.add(r.person1Id);
        ancestorsOf(r.person1Id, parentChildRels).forEach((a) => rightPersonIds.add(a));
      } else if (parent.gender === "female") {
        leftPersonIds.add(r.person1Id);
        ancestorsOf(r.person1Id, parentChildRels).forEach((a) => leftPersonIds.add(a));
      }
    }
  }

  // Drop shared ancestors from both sides.
  for (const id of [...rightPersonIds]) {
    if (leftPersonIds.has(id)) { rightPersonIds.delete(id); leftPersonIds.delete(id); }
  }
  return { rightPersonIds, leftPersonIds };
}
