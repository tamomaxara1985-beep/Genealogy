import { describe, it, expect } from "vitest";
import { computeFit } from "./exportTree";

describe("computeFit", () => {
  it("constrains a wide image by width", () => {
    // 2:1 image into a 100x100 box -> width-bound, height 50
    expect(computeFit(200, 100, 100, 100)).toEqual({ drawW: 100, drawH: 50 });
  });

  it("constrains a tall image by height", () => {
    // 1:2 image into a 100x100 box -> height-bound, width 50
    expect(computeFit(100, 200, 100, 100)).toEqual({ drawW: 50, drawH: 100 });
  });

  it("fills exactly when aspect ratios match", () => {
    expect(computeFit(100, 100, 50, 50)).toEqual({ drawW: 50, drawH: 50 });
  });
});
