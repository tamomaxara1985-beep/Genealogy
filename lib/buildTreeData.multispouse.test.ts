import { describe, it, expect } from "vitest";
import { buildTreeData } from "./buildTreeData";
import type { IPerson, IRelationship } from "@/types";

const p = (id: string, gender: IPerson["gender"] = "unknown"): IPerson =>
  ({ _id: id, treeId: "t", firstName: id, lastName: "X", gender, isLiving: true,
     createdAt: new Date(), updatedAt: new Date() } as IPerson);
const sp = (a: string, b: string): IRelationship =>
  ({ _id: `sp-${a}-${b}`, treeId: "t", type: "spouse", person1Id: a, person2Id: b });
const pc = (a: string, b: string): IRelationship =>
  ({ _id: `pc-${a}-${b}`, treeId: "t", type: "parent-child", person1Id: a, person2Id: b });

describe("buildTreeData multi-spouse (3+)", () => {
  it("builds one multiCoupleNode for a person with 3 spouses", () => {
    const persons = [p("h", "male"), p("w1", "female"), p("w2", "female"), p("w3", "female")];
    const rels = [sp("h", "w1"), sp("h", "w2"), sp("h", "w3")];
    const { nodes } = buildTreeData(persons, rels, { onSelect: () => {} }, new Set());
    const multi = nodes.filter((n) => n.type === "multiCoupleNode");
    expect(multi).toHaveLength(1);
    const d = multi[0].data as { shared: IPerson; marriages: { spouse: IPerson }[]; width: number };
    expect(d.shared._id).toBe("h");
    expect(d.marriages.map((m) => m.spouse._id).sort()).toEqual(["w1", "w2", "w3"]);
    expect(d.width).toBe(160 + 220 * 3);
    expect(nodes.some((n) => n.id === "w2")).toBe(false);
  });

  it("routes a child of the 2nd marriage to that marriage's source handle", () => {
    const persons = [p("h", "male"), p("w1", "female"), p("w2", "female"), p("w3", "female"), p("kid")];
    const rels = [sp("h", "w1"), sp("h", "w2"), sp("h", "w3"), pc("h", "kid"), pc("w2", "kid")];
    const { edges } = buildTreeData(persons, rels, { onSelect: () => {} }, new Set());
    const e = edges.find((ed) => ed.source === "multi_h");
    expect(e).toBeTruthy();
    expect(e!.sourceHandle).toBe("m1"); // w2 is marriage index 1 (order w1,w2,w3)
  });

  it("leaves a 2-spouse person as a polyCoupleNode (unchanged)", () => {
    const persons = [p("h", "male"), p("w1", "female"), p("w2", "female")];
    const { nodes } = buildTreeData(persons, [sp("h", "w1"), sp("h", "w2")], { onSelect: () => {} }, new Set());
    expect(nodes.some((n) => n.type === "polyCoupleNode")).toBe(true);
    expect(nodes.some((n) => n.type === "multiCoupleNode")).toBe(false);
  });
});
