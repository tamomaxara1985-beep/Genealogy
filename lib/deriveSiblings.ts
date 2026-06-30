import type { IRelationship, ISiblingHide } from "@/types";

export function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function deriveSiblingIds(
  personId: string,
  relationships: IRelationship[]
): string[] {
  const parentChild = relationships.filter((r) => r.type === "parent-child");
  const parentIds = new Set(
    parentChild.filter((r) => r.person2Id === personId).map((r) => r.person1Id)
  );
  const siblings = new Set<string>();
  for (const r of parentChild) {
    if (parentIds.has(r.person1Id) && r.person2Id !== personId) {
      siblings.add(r.person2Id);
    }
  }
  return [...siblings];
}

export function splitSiblingsByHide(
  personId: string,
  siblingIds: string[],
  hides: ISiblingHide[]
): { visible: string[]; hidden: { siblingId: string; hideId: string }[] } {
  const hideByPair = new Map<string, string>();
  for (const h of hides) {
    const [a, b] = normalizePair(h.personAId, h.personBId);
    hideByPair.set(`${a}|${b}`, h._id);
  }
  const visible: string[] = [];
  const hidden: { siblingId: string; hideId: string }[] = [];
  for (const sib of siblingIds) {
    const [a, b] = normalizePair(personId, sib);
    const hideId = hideByPair.get(`${a}|${b}`);
    if (hideId) hidden.push({ siblingId: sib, hideId });
    else visible.push(sib);
  }
  return { visible, hidden };
}
