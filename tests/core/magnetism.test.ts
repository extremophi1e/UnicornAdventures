import { describe, it, expect } from "vitest";
import { nearestEnemy, steerVelocity } from "../../src/core/magnetism";

describe("nearestEnemy", () => {
  it("finds the closest within range", () => {
    const idx = nearestEnemy({ x: 0, y: 0 }, [{ x: 300, y: 0 }, { x: 50, y: 0 }], 200);
    expect(idx).toBe(1);
  });
  it("returns -1 when none in range", () => {
    expect(nearestEnemy({ x: 0, y: 0 }, [{ x: 999, y: 0 }], 100)).toBe(-1);
  });
});

describe("steerVelocity", () => {
  it("pulls a straight-up star horizontally toward a target to its right", () => {
    const v = steerVelocity({ x: 0, y: -100 }, { x: 0, y: 0 }, { x: 100, y: -200 }, 5, 0.1);
    expect(v.x).toBeGreaterThan(0);
  });
  it("preserves speed magnitude (within tolerance)", () => {
    const v = steerVelocity({ x: 0, y: -100 }, { x: 0, y: 0 }, { x: 100, y: -200 }, 5, 0.1);
    const speed = Math.hypot(v.x, v.y);
    expect(Math.abs(speed - 100)).toBeLessThan(1);
  });
});
