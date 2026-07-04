import { describe, it, expect } from "vitest";
import { applyDagreLayout } from "./treeLayout";

const multi = (id: string, width: number, x: number) =>
  ({ id, type: "multiCoupleNode", position: { x, y: 0 }, data: { width } } as unknown as {
    id: string; type?: string; position: { x: number; y: number }; data: unknown;
  });

describe("treeLayout multiCoupleNode width", () => {
  it("uses data.width so wide multi nodes do not overlap in a row", () => {
    const nodes = [multi("A", 820, 0), multi("B", 820, 100)];
    const laid = applyDagreLayout(nodes as never, []);
    const a = laid.find((n) => n.id === "A")!;
    const b = laid.find((n) => n.id === "B")!;
    if (Math.round(a.position.y) === Math.round(b.position.y)) {
      expect(b.position.x).toBeGreaterThanOrEqual(a.position.x + 820);
    }
  });
});
