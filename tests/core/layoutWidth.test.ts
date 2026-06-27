import { describe, it, expect } from "vitest";
import { computeLogicalWidth } from "../../src/core/viewport";

describe("computeLogicalWidth", () => {
  it("matches a tall phone's aspect (fills the screen, no letterbox)", () => {
    // 400x900 ≈ 0.444 aspect → ~569; it must follow the device aspect, NOT be
    // clamped up to a wider floor (which is what caused top/bottom blue bars).
    expect(computeLogicalWidth(400, 900)).toBe(569);
    expect(computeLogicalWidth(400, 900)).toBeLessThan(720);
  });
  it("clamps an ultra-narrow viewport to the floor (520)", () => {
    expect(computeLogicalWidth(300, 1000)).toBe(520);
  });
  it("clamps wide (PC) to 1100", () => {
    expect(computeLogicalWidth(2000, 1000)).toBe(1100);
  });
  it("scales proportionally in between", () => {
    expect(computeLogicalWidth(800, 1280)).toBe(800);
  });
});
