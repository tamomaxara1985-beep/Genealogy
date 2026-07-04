import { describe, it, expect } from "vitest";
import { enforceRowGaps } from "./treeLayout";

// helper: build the inputs enforceRowGaps expects
function run(
  nodes: { id: string; x: number; y: number; w: number }[],
  parents: Record<string, string[]>,
  minGap: number
) {
  const ids = nodes.map((n) => n.id);
  const cx = new Map(nodes.map((n) => [n.id, n.x]));
  const y = new Map(nodes.map((n) => [n.id, n.y]));
  const width = (id: string) => nodes.find((n) => n.id === id)!.w;
  const parentsOf = (id: string) => parents[id] ?? [];
  return enforceRowGaps(ids, cx, y, width, parentsOf, minGap);
}

describe("enforceRowGaps", () => {
  it("pushes an overlapping node right to at least minGap", () => {
    // A center 0 (w100 -> -50..50), B center 60 (10..110): overlap of 40
    const out = run(
      [
        { id: "A", x: 0, y: 0, w: 100 },
        { id: "B", x: 60, y: 0, w: 100 },
      ],
      {},
      20
    );
    // B must clear A.right(50) + minGap(20) + B halfWidth(50) = 120
    expect(out.get("A")).toBe(0);
    expect(out.get("B")).toBe(120);
    // resulting card gap = B.left(70) - A.right(50) = 20
    expect(out.get("B")! - 50 - (out.get("A")! + 50)).toBe(20);
  });

  it("does not move nodes that already clear the minimum gap", () => {
    const out = run(
      [
        { id: "A", x: 0, y: 0, w: 100 },
        { id: "B", x: 500, y: 0, w: 100 },
      ],
      {},
      20
    );
    expect(out.get("A")).toBe(0);
    expect(out.get("B")).toBe(500);
  });

  it("co-shifts a node's ancestors by the same delta (keeps the cone rigid)", () => {
    // A,B overlap in bottom row (y=0). B has ancestor PB in upper row (y=-100).
    // When B shifts right, PB shifts by the same delta.
    const out = run(
      [
        { id: "A", x: 0, y: 0, w: 100 },
        { id: "B", x: 60, y: 0, w: 100 },
        { id: "PB", x: 60, y: -100, w: 100 },
      ],
      { B: ["PB"] },
      20
    );
    const delta = out.get("B")! - 60; // 120 - 60 = 60
    expect(delta).toBe(60);
    expect(out.get("PB")).toBe(60 + delta); // 120
  });

  it("leaves rows independent (a shift in one row does not touch an unrelated row)", () => {
    const out = run(
      [
        { id: "A", x: 0, y: 0, w: 100 },
        { id: "B", x: 60, y: 0, w: 100 },
        { id: "C", x: 0, y: 200, w: 100 }, // unrelated lower row, no overlap
      ],
      {},
      20
    );
    expect(out.get("C")).toBe(0);
  });
});
