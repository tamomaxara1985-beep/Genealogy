import { describe, it, expect } from "vitest";
import { buildTreeData } from "./buildTreeData";
import type { IPerson } from "@/types";

const p = (id: string, gender: IPerson["gender"]): IPerson =>
  ({ _id: id, treeId: "t", firstName: id, lastName: "X", gender, isLiving: true,
     createdAt: new Date(), updatedAt: new Date() } as IPerson);

describe("buildTreeData sibling plumbing", () => {
  it("passes siblingInfo and onToggleSiblings to a person node", () => {
    const toggle = () => {};
    const info = { a: { count: 2, expanded: false } };
    const { nodes } = buildTreeData(
      [p("a", "male")],
      [],
      { onSelect: () => {}, siblingInfo: info, onToggleSiblings: toggle },
      new Set()
    );
    const node = nodes.find((n) => n.id === "a");
    expect((node!.data as { siblingInfo?: unknown }).siblingInfo).toBe(info);
    expect((node!.data as { onToggleSiblings?: unknown }).onToggleSiblings).toBe(toggle);
  });
});
