import { describe, it, expect } from "vitest";
import { nodesContentSignature } from "./treeNodesSignature";
import type { IPerson } from "@/types";
import type { PersonNodeType } from "@/components/tree/PersonNode";

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
});
