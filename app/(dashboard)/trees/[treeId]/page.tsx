"use client";
import { FamilyTree } from "@/components/tree/FamilyTree";
import type { TreeNode, TreeEdge } from "@/types";

const stubNodes: TreeNode[] = [
  {
    id: "1",
    type: "personNode",
    position: { x: 300, y: 50 },
    data: {
      person: {
        _id: "1",
        treeId: "x",
        firstName: "John",
        lastName: "Smith",
        gender: "male",
        isLiving: false,
        birthDate: "1920-03-14",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  },
  {
    id: "2",
    type: "personNode",
    position: { x: 100, y: 250 },
    data: {
      person: {
        _id: "2",
        treeId: "x",
        firstName: "Mary",
        lastName: "Smith",
        gender: "female",
        isLiving: false,
        birthDate: "1922-07-05",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  },
  {
    id: "3",
    type: "personNode",
    position: { x: 500, y: 250 },
    data: {
      person: {
        _id: "3",
        treeId: "x",
        firstName: "Robert",
        lastName: "Smith",
        gender: "male",
        isLiving: true,
        birthDate: "1950-11-22",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  },
];

const stubEdges: TreeEdge[] = [
  { id: "e1-2", source: "1", target: "2", type: "step", label: "child" },
  { id: "e1-3", source: "1", target: "3", type: "step", label: "child" },
];

export default function TreePage({
  params,
}: {
  params: { treeId: string };
}) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Family Tree</h1>
        <p className="text-sm text-muted-foreground">Tree ID: {params.treeId}</p>
      </div>
      <FamilyTree
        nodes={stubNodes}
        edges={stubEdges}
        onNodeClick={(id) => console.log("clicked person", id)}
      />
    </div>
  );
}
