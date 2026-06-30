import type { IRelationship } from "@/types";

function parentsByChild(rels: IRelationship[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rels) {
    if (r.type !== "parent-child") continue;
    const arr = m.get(r.person2Id) ?? [];
    if (!arr.includes(r.person1Id)) arr.push(r.person1Id);
    m.set(r.person2Id, arr);
  }
  return m;
}

function hasSpouseBetween(a: string, b: string, rels: IRelationship[]): boolean {
  return rels.some(
    (r) =>
      r.type === "spouse" &&
      ((r.person1Id === a && r.person2Id === b) ||
        (r.person1Id === b && r.person2Id === a))
  );
}

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function coParentPairForChild(
  childId: string,
  relationships: IRelationship[]
): [string, string] | null {
  const parents = parentsByChild(relationships).get(childId) ?? [];
  if (parents.length !== 2) return null;
  const [a, b] = parents;
  if (hasSpouseBetween(a, b, relationships)) return null;
  return normalizePair(a, b);
}

export function coParentPairsNeedingSpouse(
  relationships: IRelationship[]
): Array<[string, string]> {
  const map = parentsByChild(relationships);
  const seen = new Set<string>();
  const pairs: Array<[string, string]> = [];
  for (const parents of map.values()) {
    if (parents.length !== 2) continue;
    const [a, b] = normalizePair(parents[0], parents[1]);
    if (hasSpouseBetween(a, b, relationships)) continue;
    const key = `${a}|${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([a, b]);
  }
  return pairs;
}
