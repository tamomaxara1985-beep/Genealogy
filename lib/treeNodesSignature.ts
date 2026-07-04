import type { IPerson } from "@/types";
import type { PersonNodeType } from "@/components/tree/PersonNode";
import type { CoupleNodeType } from "@/components/tree/CoupleNode";
import type { PolyCoupleNodeType } from "@/components/tree/PolyCoupleNode";

type AnyNode = PersonNodeType | CoupleNodeType | PolyCoupleNodeType;
type SiblingInfo = Record<string, { count: number; expanded: boolean }> | undefined;

function personSig(p: IPerson, siblingInfo: SiblingInfo): string {
  const s = siblingInfo?.[p._id];
  const sib = s ? `${s.count}/${s.expanded}` : "";
  return `${p._id}:${p.firstName}:${p.lastName}:${p.birthDate ?? ""}:${p.deathDate ?? ""}:${p.isLiving}:${p.photoUrl ?? ""}:${p.gender}:${sib}`;
}

/**
 * Deterministic signature of the display-relevant content of the tree nodes.
 * Changes iff a field shown on a card (name, dates, living state, photo),
 * a divorce marker, a per-person collapse flag, or a per-person sibling
 * control (count/expanded) changes. Ignores positions and callback identity,
 * so it is safe to use as a React memo dependency that fires on content edits
 * but not on re-renders that only produce new callback closures.
 */
export function nodesContentSignature(nodes: AnyNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "coupleNode") {
        const d = n.data;
        return [
          n.id,
          personSig(d.person1, d.siblingInfo),
          personSig(d.person2, d.siblingInfo),
          `div:${d.isDivorced ?? false}:${d.divorceDate ?? ""}`,
          `c:${d.isCollapsed1 ?? false}:${d.isCollapsed2 ?? false}`,
        ].join("|");
      }
      if (n.type === "polyCoupleNode") {
        const d = n.data;
        return [
          n.id,
          personSig(d.leftSpouse, d.siblingInfo),
          personSig(d.shared, d.siblingInfo),
          personSig(d.rightSpouse, d.siblingInfo),
          `div:${d.isDivorced1 ?? false}:${d.divorceDate1 ?? ""}:${d.isDivorced2 ?? false}:${d.divorceDate2 ?? ""}`,
        ].join("|");
      }
      const d = n.data;
      return [n.id, personSig(d.person, d.siblingInfo), `c:${d.isCollapsed ?? false}`].join("|");
    })
    .join(";");
}
