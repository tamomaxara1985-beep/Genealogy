import { describe, it, expect } from "vitest";
import { buildTreeData } from "./buildTreeData";
import { applyDagreLayout } from "./treeLayout";
import type { IPerson, IRelationship } from "@/types";

const P = (id: string, gender: IPerson["gender"] = "unknown"): IPerson =>
  ({ _id: id, treeId: "t", firstName: id, lastName: "X", gender, isLiving: true,
     createdAt: new Date(), updatedAt: new Date() } as IPerson);
const sp = (a: string, b: string): IRelationship =>
  ({ _id: `sp-${a}-${b}`, treeId: "t", type: "spouse", person1Id: a, person2Id: b });
const pc = (a: string, b: string): IRelationship =>
  ({ _id: `pc-${a}-${b}`, treeId: "t", type: "parent-child", person1Id: a, person2Id: b });

const centerX = (laid: { id: string; position: { x: number }; type?: string }[], id: string, w: number) =>
  laid.find((n) => n.id === id)!.position.x + w / 2;

// Regression: a lone parent of a poly-node spouse must sit above THAT spouse's
// card, not the node centre. ("Anna's father" was landing left of Anna.)
describe("in-law / lone parent placement over multi-spouse nodes", () => {
  it("places the right spouse's lone parent above the right card (not centre)", () => {
    const persons = [P("H", "male"), P("W1", "female"), P("W2"), P("kid", "male"), P("dad", "male")];
    const rels = [sp("H", "W1"), sp("H", "W2"), pc("H", "kid"), pc("W1", "kid"), pc("dad", "W2")];
    const { nodes, edges } = buildTreeData(persons, rels, { onSelect: () => {} }, new Set());
    const poly = nodes.find((n) => n.type === "polyCoupleNode")!;
    const laid = applyDagreLayout(nodes as never, edges as never) as never as
      { id: string; position: { x: number } }[];
    const polyCenter = centerX(laid, poly.id, 600); // POLY_COUPLE_W
    const dadCenter = centerX(laid, "dad", 168);      // PERSON_W
    // W2 is the right spouse → its parent must be to the RIGHT of the poly centre.
    expect(dadCenter).toBeGreaterThan(polyCenter + 100);
  });

  it("keeps a lone parent of an ordinary person centred above them", () => {
    const persons = [P("child", "male"), P("mom", "female")];
    const rels = [pc("mom", "child")];
    const { nodes, edges } = buildTreeData(persons, rels, { onSelect: () => {} }, new Set());
    const laid = applyDagreLayout(nodes as never, edges as never) as never as
      { id: string; position: { x: number } }[];
    expect(centerX(laid, "mom", 168)).toBeCloseTo(centerX(laid, "child", 168), 0);
  });
});
