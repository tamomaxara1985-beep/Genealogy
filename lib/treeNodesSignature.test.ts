import { describe, it, expect } from "vitest";
import { nodesContentSignature, edgesSignature } from "./treeNodesSignature";
import type { IPerson, TreeEdge } from "@/types";
import type { PersonNodeType } from "@/components/tree/PersonNode";
import type { MultiCoupleNodeType } from "@/components/tree/MultiCoupleNode";

const person = (over: Partial<IPerson> = {}): IPerson =>
  ({ _id: "p1", treeId: "t", firstName: "Lina", lastName: "K", gender: "female",
     isLiving: false, deathDate: "2020", createdAt: new Date(), updatedAt: new Date(), ...over } as IPerson);

const personNode = (p: IPerson): PersonNodeType =>
  ({ id: p._id, type: "personNode", position: { x: 0, y: 0 },
     data: { person: p, onSelect: () => {} } } as PersonNodeType);

describe("nodesContentSignature", () => {
  it("changes when a person's deathDate changes", () => {
    const a = nodesContentSignature([personNode(person({ deathDate: "2020" }))]);
    const b = nodesContentSignature([personNode(person({ deathDate: "2021" }))]);
    expect(a).not.toBe(b);
  });

  it("is stable when only the position / callbacks change", () => {
    const p = person();
    const n1 = personNode(p);
    const n2: PersonNodeType = { ...n1, position: { x: 999, y: 999 }, data: { person: p, onSelect: () => {} } };
    expect(nodesContentSignature([n1])).toBe(nodesContentSignature([n2]));
  });

  it("changes when isLiving flips", () => {
    const a = nodesContentSignature([personNode(person({ isLiving: true }))]);
    const b = nodesContentSignature([personNode(person({ isLiving: false }))]);
    expect(a).not.toBe(b);
  });

  it("changes when gender changes", () => {
    const a = nodesContentSignature([personNode(person({ gender: "female" }))]);
    const b = nodesContentSignature([personNode(person({ gender: "male" }))]);
    expect(a).not.toBe(b);
  });
});

const edge = (over: Partial<TreeEdge> = {}): TreeEdge =>
  ({ id: "r1", source: "a", target: "b", type: "smoothstep", ...over });

describe("edgesSignature", () => {
  it("changes when an edge's target changes but its id stays the same", () => {
    // person 'b' merges into a couple node → edge id r1 unchanged, target retargets
    const before = edgesSignature([edge({ target: "b" })]);
    const after = edgesSignature([edge({ target: "couple_x" })]);
    expect(before).not.toBe(after);
  });

  it("changes when an edge's source retargets to a couple node", () => {
    const before = edgesSignature([edge({ source: "a" })]);
    const after = edgesSignature([edge({ source: "couple_y" })]);
    expect(before).not.toBe(after);
  });

  it("changes when a targetHandle changes", () => {
    const before = edgesSignature([edge({ targetHandle: "person1" })]);
    const after = edgesSignature([edge({ targetHandle: "person2" })]);
    expect(before).not.toBe(after);
  });

  it("is stable when nothing structural changes", () => {
    expect(edgesSignature([edge()])).toBe(edgesSignature([edge()]));
  });
});

const multiNode = (spouses: IPerson[]): MultiCoupleNodeType =>
  ({ id: "multi_h", type: "multiCoupleNode", position: { x: 0, y: 0 },
     data: {
       shared: person({ _id: "h" }),
       marriages: spouses.map((s) => ({ spouse: s })),
       width: 160 + 220 * spouses.length,
       onSelect: () => {},
     } } as MultiCoupleNodeType);

describe("nodesContentSignature multiCoupleNode", () => {
  it("changes when a spouse's name changes", () => {
    const a = nodesContentSignature([multiNode([person({ _id: "w1", firstName: "Ann" })])]);
    const b = nodesContentSignature([multiNode([person({ _id: "w1", firstName: "Anna" })])]);
    expect(a).not.toBe(b);
  });

  it("changes when a spouse is added", () => {
    const a = nodesContentSignature([multiNode([person({ _id: "w1" }), person({ _id: "w2" })])]);
    const b = nodesContentSignature([multiNode([person({ _id: "w1" }), person({ _id: "w2" }), person({ _id: "w3" })])]);
    expect(a).not.toBe(b);
  });
});
