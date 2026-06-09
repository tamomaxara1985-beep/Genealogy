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
      if (r.type === "parent-child" && r.person2Id === cur && !ancestors.has(r.person1Id)) {
        ancestors.add(r.person1Id);
        queue.push(r.person1Id);
      }
    }
  }
  return ancestors;
}
