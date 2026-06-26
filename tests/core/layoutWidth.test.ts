import { describe, it, expect } from "vitest";
import { computeLogicalWidth } from "../../src/core/viewport";

describe("computeLogicalWidth", () => {
  it("clamps narrow (tall phone) to 720", () => {
    expect(computeLogicalWidth(400, 900)).toBe(720);
  });
  it("clamps wide (PC) to 1100", () => {
    expect(computeLogicalWidth(2000, 1000)).toBe(1100);
  });
  it("scales proportionally in between", () => {
    const w = computeLogicalWidth(800, 1280);
    expect(w).toBeGreaterThan(720);
    expect(w).toBeLessThan(1100);
  });
});
