import type { IRelationship } from "@/types";

/**
 * BFS upward through parent-child edges.
 * Returns IDs of all ancestors of personId (not including personId itself).
 */
export function getAncestors(
  personId: string,
  relationships: IRelationship[]
): Set<string> {
  const ancestors = new Set<string>();
  const queue = [personId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const r of relationships) {
      if (
        r.type === "parent-child" &&
        r.person2Id === cur &&
        !ancestors.has(r.person1Id) &&
        r.person1Id !== personId
      ) {
        ancestors.add(r.person1Id);
        queue.push(r.person1Id);
      }
    }
  }
  return ancestors;
}

/**
 * BFS downward through parent-child edges.
 * Returns IDs of all descendants of personId (not including personId itself).
 */
export function getDescendants(
  personId: string,
  relationships: IRelationship[]
): Set<string> {
  const descendants = new Set<string>();
  const queue = [personId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const r of relationships) {
      if (
        r.type === "parent-child" &&
        r.person1Id === cur &&
        !descendants.has(r.person2Id) &&
        r.person2Id !== personId
      ) {
        descendants.add(r.person2Id);
        queue.push(r.person2Id);
      }
    }
  }
  return descendants;
}

/**
 * Siblings of personId: anyone sharing at least one parent (full + half).
 * Excludes personId itself. Empty if personId has no recorded parents.
 */
export function getSiblings(
  personId: string,
  relationships: IRelationship[]
): Set<string> {
  const parents = new Set<string>();
  for (const r of relationships) {
    if (r.type === "parent-child" && r.person2Id === personId) {
      parents.add(r.person1Id);
    }
  }
  const siblings = new Set<string>();
  if (parents.size === 0) return siblings;
  for (const r of relationships) {
    if (
      r.type === "parent-child" &&
      parents.has(r.person1Id) &&
      r.person2Id !== personId
    ) {
      siblings.add(r.person2Id);
    }
  }
  return siblings;
}
