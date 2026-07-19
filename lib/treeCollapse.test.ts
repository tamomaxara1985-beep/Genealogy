import { describe, it, expect } from "vitest";
import { getCoreVisible, getSpouses, getSiblingRevealSet } from "./treeCollapse";
import type { IRelationship } from "@/types";

const pc = (parent: string, child: string): IRelationship =>
  ({ _id: `pc-${parent}-${child}`, treeId: "t", type: "parent-child", person1Id: parent, person2Id: child });
const sp = (a: string, b: string): IRelationship =>
  ({ _id: `sp-${a}-${b}`, treeId: "t", type: "spouse", person1Id: a, person2Id: b });

describe("getCoreVisible", () => {
  it("root alone yields just the root", () => {
    expect([...getCoreVisible("root", [])]).toEqual(["root"]);
  });

  it("includes both parents and grandparents (full pedigree)", () => {
    const rels = [pc("dad", "root"), pc("mom", "root"), pc("gpa", "dad"), pc("gma", "dad")];
    const core = getCoreVisible("root", rels);
    ["root", "dad", "mom", "gpa", "gma"].forEach((id) => expect(core.has(id)).toBe(true));
  });

  it("includes descendants and their spouses", () => {
    const rels = [pc("root", "kid"), sp("kid", "kidspouse")];
    const core = getCoreVisible("root", rels);
    expect(core.has("kid")).toBe(true);
    expect(core.has("kidspouse")).toBe(true);
  });

  it("includes the root's own spouse", () => {
    const core = getCoreVisible("root", [sp("root", "wife")]);
    expect(core.has("wife")).toBe(true);
  });

  it("excludes the root's siblings", () => {
    const rels = [pc("dad", "root"), pc("dad", "sib")];
    expect(getCoreVisible("root", rels).has("sib")).toBe(false);
  });

  it("includes an ancestor's additional spouse (spouse of any visible person)", () => {
    const rels = [pc("dad", "root"), sp("dad", "stepmom")];
    expect(getCoreVisible("root", rels).has("stepmom")).toBe(true);
  });

  it("getSpouses returns partners in both directions", () => {
    const rels = [sp("a", "b"), sp("c", "a")];
    const out = getSpouses("a", rels);
    expect([...out].sort()).toEqual(["b", "c"]);
  });

  it("getCoreVisible includes the root's spouse's parents (in-law pedigree)", () => {
    const rels = [sp("root", "wife"), pc("wifeDad", "wife"), pc("wifeMom", "wife"), pc("wifeGpa", "wifeDad")];
    const core = getCoreVisible("root", rels);
    ["wife", "wifeDad", "wifeMom", "wifeGpa"].forEach((id) => expect(core.has(id)).toBe(true));
  });

  it("getCoreVisible does NOT include the root spouse's siblings (in-law collateral stays collapsed)", () => {
    const rels = [sp("root", "wife"), pc("wifeDad", "wife"), pc("wifeDad", "wifeSister")];
    expect(getCoreVisible("root", rels).has("wifeSister")).toBe(false);
  });

  // Regression: adding a parent to an in-law spouse of a visible ancestor must show that parent.
  // Mirrors "Anna's father": Svimon (ancestor) has 2nd wife Anna; Anna's father Ivane was hidden.
  it("includes the ancestors of an in-law spouse of a visible person", () => {
    const rels = [pc("dad", "root"), sp("dad", "stepmom"), pc("stepmomDad", "stepmom")];
    const core = getCoreVisible("root", rels);
    expect(core.has("stepmom")).toBe(true);
    expect(core.has("stepmomDad")).toBe(true);
  });

  it("still keeps an in-law spouse's SIBLINGS collapsed (only ancestors surface)", () => {
    const rels = [pc("dad", "root"), sp("dad", "stepmom"), pc("smDad", "stepmom"), pc("smDad", "stepmomSister")];
    expect(getCoreVisible("root", rels).has("stepmomSister")).toBe(false);
  });
});

describe("getSiblingRevealSet", () => {
  // Regression: expanding a sibling must also reveal that sibling's descendants.
  // Mirrors "Goga+Sofo's children": Goga is root's sibling; his children were hidden.
  it("reveals an expanded person's siblings, their descendants, and spouses", () => {
    const rels = [
      pc("dad", "root"),
      pc("dad", "sib"),          // sib is root's sibling
      sp("sib", "sibSpouse"),
      pc("sib", "niece"),        // sib's child
      pc("sibSpouse", "niece"),
      pc("niece", "grandniece"), // deeper descendant
    ];
    const revealed = getSiblingRevealSet(new Set(["root"]), rels);
    ["sib", "sibSpouse", "niece", "grandniece"].forEach((id) =>
      expect(revealed.has(id)).toBe(true)
    );
  });

  it("is empty when nothing is expanded", () => {
    const rels = [pc("dad", "root"), pc("dad", "sib")];
    expect(getSiblingRevealSet(new Set(), rels).size).toBe(0);
  });
});
