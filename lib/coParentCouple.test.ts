import { describe, it, expect } from "vitest";
import { coParentPairForChild, coParentPairsNeedingSpouse } from "./coParentCouple";
import type { IRelationship } from "@/types";

const r = (type: IRelationship["type"], a: string, b: string, endDate?: string): IRelationship =>
  ({ _id: `${type}-${a}-${b}`, treeId: "t", type, person1Id: a, person2Id: b, endDate });

describe("coParentPairForChild", () => {
  it("returns the normalized pair for a child with exactly 2 parents and no spouse rel", () => {
    const rels = [r("parent-child", "dad", "kid"), r("parent-child", "mom", "kid")];
    expect(coParentPairForChild("kid", rels)).toEqual(["dad", "mom"]);
  });

  it("returns null when a spouse rel already exists (even divorced)", () => {
    const rels = [
      r("parent-child", "dad", "kid"),
      r("parent-child", "mom", "kid"),
      r("spouse", "mom", "dad", "1990"),
    ];
    expect(coParentPairForChild("kid", rels)).toBeNull();
  });

  it("returns null for 1 parent and for 3+ parents", () => {
    expect(coParentPairForChild("kid", [r("parent-child", "dad", "kid")])).toBeNull();
    const three = [
      r("parent-child", "dad", "kid"),
      r("parent-child", "mom", "kid"),
      r("parent-child", "step", "kid"),
    ];
    expect(coParentPairForChild("kid", three)).toBeNull();
  });
});

describe("coParentPairsNeedingSpouse", () => {
  it("dedups a pair that co-parents multiple children", () => {
    const rels = [
      r("parent-child", "dad", "kid1"), r("parent-child", "mom", "kid1"),
      r("parent-child", "dad", "kid2"), r("parent-child", "mom", "kid2"),
    ];
    expect(coParentPairsNeedingSpouse(rels)).toEqual([["dad", "mom"]]);
  });

  it("skips pairs that already have a spouse rel; includes those that don't", () => {
    const rels = [
      r("parent-child", "dad", "kid1"), r("parent-child", "mom", "kid1"),
      r("spouse", "dad", "mom"),
      r("parent-child", "a", "kid2"), r("parent-child", "b", "kid2"),
    ];
    expect(coParentPairsNeedingSpouse(rels)).toEqual([["a", "b"]]);
  });

  it("returns empty when there are no qualifying children", () => {
    expect(coParentPairsNeedingSpouse([r("parent-child", "dad", "kid")])).toEqual([]);
  });
});
