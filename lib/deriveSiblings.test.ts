import { describe, it, expect } from "vitest";
import { normalizePair, deriveSiblingIds, splitSiblingsByHide } from "./deriveSiblings";
import type { IRelationship, ISiblingHide } from "@/types";

const rel = (
  type: IRelationship["type"],
  person1Id: string,
  person2Id: string
): IRelationship => ({ _id: `${type}-${person1Id}-${person2Id}`, treeId: "t1", type, person1Id, person2Id });

describe("normalizePair", () => {
  it("sorts the pair lexicographically", () => {
    expect(normalizePair("b", "a")).toEqual(["a", "b"]);
    expect(normalizePair("a", "b")).toEqual(["a", "b"]);
  });
});

describe("deriveSiblingIds", () => {
  it("returns people who share a parent, excluding self", () => {
    const rels = [
      rel("parent-child", "dad", "kid1"),
      rel("parent-child", "dad", "kid2"),
      rel("parent-child", "dad", "kid3"),
    ];
    expect(deriveSiblingIds("kid1", rels).sort()).toEqual(["kid2", "kid3"]);
  });

  it("dedups a sibling shared via two parents", () => {
    const rels = [
      rel("parent-child", "dad", "kid1"),
      rel("parent-child", "dad", "kid2"),
      rel("parent-child", "mom", "kid1"),
      rel("parent-child", "mom", "kid2"),
    ];
    expect(deriveSiblingIds("kid1", rels)).toEqual(["kid2"]);
  });

  it("ignores spouse rels and returns empty when no shared parent", () => {
    const rels = [
      rel("parent-child", "dad", "kid1"),
      rel("spouse", "kid1", "someone"),
    ];
    expect(deriveSiblingIds("kid1", rels)).toEqual([]);
  });
});

describe("splitSiblingsByHide", () => {
  const hide = (a: string, b: string): ISiblingHide => {
    const [personAId, personBId] = [a, b].sort();
    return { _id: `h-${personAId}-${personBId}`, treeId: "t1", personAId, personBId };
  };

  it("moves hidden pairs out of visible, regardless of stored order", () => {
    const result = splitSiblingsByHide("kid1", ["kid2", "kid3"], [hide("kid3", "kid1")]);
    expect(result.visible).toEqual(["kid2"]);
    expect(result.hidden).toEqual([{ siblingId: "kid3", hideId: "h-kid1-kid3" }]);
  });

  it("keeps all visible when no hides match", () => {
    const result = splitSiblingsByHide("kid1", ["kid2"], [hide("x", "y")]);
    expect(result.visible).toEqual(["kid2"]);
    expect(result.hidden).toEqual([]);
  });
});
