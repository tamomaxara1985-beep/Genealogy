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

/**
 * Partner ids of a person via spouse relationships (both directions).
 */
export function getSpouses(
  personId: string,
  relationships: IRelationship[]
): Set<string> {
  const out = new Set<string>();
  for (const r of relationships) {
    if (r.type !== "spouse") continue;
    if (r.person1Id === personId) out.add(r.person2Id);
    else if (r.person2Id === personId) out.add(r.person1Id);
  }
  return out;
}

/**
 * Person IDs visible by default in the pedigree view:
 *  - the root
 *  - all of the root's ancestors (both parents each generation → full pedigree)
 *  - all of the root's descendants
 *  - the root's spouse(s) and their ancestors (in-law pedigree on the spouse's side;
 *    collateral stays collapsed by default)
 *  - the spouse of any visible person (root, ancestors, or descendants)
 *    so additional spouses render wherever their partner is visible
 */
export function getCoreVisible(
  rootId: string,
  relationships: IRelationship[]
): Set<string> {
  const core = new Set<string>([rootId]);
  getAncestors(rootId, relationships).forEach((id) => core.add(id));

  const descendants = getDescendants(rootId, relationships);
  descendants.forEach((id) => core.add(id));

  // Root's spouse(s) and their ancestors — show the in-law pedigree on the
  // spouse's side of the root couple (collateral stays collapsed by default).
  for (const sp of getSpouses(rootId, relationships)) {
    core.add(sp);
    getAncestors(sp, relationships).forEach((id) => core.add(id));
  }

  // Add the spouse of any visible person (root, ancestors, or descendants) so
  // additional spouses render wherever their partner is visible — and, like the
  // root's own spouse, surface that in-law's ancestor pedigree so a parent added
  // to an in-law is not orphaned off-screen. (Collateral — the in-law's siblings —
  // still stays collapsed: only the upward line is added.)
  const coreSnapshot = new Set(core);
  for (const r of relationships) {
    if (r.type !== "spouse") continue;
    for (const [a, b] of [[r.person1Id, r.person2Id], [r.person2Id, r.person1Id]] as const) {
      if (!coreSnapshot.has(a)) continue;
      core.add(b);
      getAncestors(b, relationships).forEach((id) => core.add(id));
    }
  }
  return core;
}

/**
 * Reveal set for expanded collateral siblings.
 *
 * For each person whose sibling group is expanded, returns that person's
 * siblings PLUS each sibling's full descendant subtree PLUS the spouse of
 * everyone revealed (so revealed people pair into couple nodes and the
 * children a user adds under an expanded sibling are not left off-screen).
 * Does not include the expanded person itself.
 */
export function getSiblingRevealSet(
  expandedIds: Set<string>,
  relationships: IRelationship[]
): Set<string> {
  const revealed = new Set<string>();
  for (const id of expandedIds) {
    for (const sib of getSiblings(id, relationships)) {
      revealed.add(sib);
      getDescendants(sib, relationships).forEach((d) => revealed.add(d));
    }
  }
  // Spouses of everyone revealed, so they pair into couple nodes.
  for (const r of relationships) {
    if (r.type !== "spouse") continue;
    if (revealed.has(r.person1Id)) revealed.add(r.person2Id);
    if (revealed.has(r.person2Id)) revealed.add(r.person1Id);
  }
  return revealed;
}
