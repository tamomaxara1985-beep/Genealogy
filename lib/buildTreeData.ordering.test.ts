import { describe, it, expect } from "vitest";
import { buildTreeData } from "./buildTreeData";
import type { IPerson, IRelationship } from "@/types";

const p = (id: string, gender: IPerson["gender"]): IPerson =>
  ({ _id: id, treeId: "t", firstName: id, lastName: "X", gender, isLiving: true,
     createdAt: new Date(), updatedAt: new Date() } as IPerson);

const spouse = (a: string, b: string): IRelationship =>
  ({ _id: `s-${a}-${b}`, treeId: "t", type: "spouse", person1Id: a, person2Id: b });

function coupleOf(persons: IPerson[], a: string, b: string) {
  const { nodes } = buildTreeData(persons, [spouse(a, b)], { onSelect: () => {} }, new Set());
  const c = nodes.find((n) => n.type === "coupleNode");
  if (!c) throw new Error("no couple node");
  const data = c.data as { person1: IPerson; person2: IPerson };
  return { left: data.person1.gender, right: data.person2.gender };
}

describe("buildTreeData couple ordering — female left, male right", () => {
  it("female-first stays female-left/male-right", () => {
    expect(coupleOf([p("f", "female"), p("m", "male")], "f", "m")).toEqual({ left: "female", right: "male" });
  });
  it("male-first is swapped to female-left/male-right", () => {
    expect(coupleOf([p("m", "male"), p("f", "female")], "m", "f")).toEqual({ left: "female", right: "male" });
  });
  it("unknown + male puts male on the right", () => {
    expect(coupleOf([p("m", "male"), p("u", "unknown")], "m", "u")).toEqual({ left: "unknown", right: "male" });
  });
});
