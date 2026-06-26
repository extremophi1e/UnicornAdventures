import { describe, it, expect } from "vitest";
import { resolveTarget, AutoFire } from "../../src/core/input";

const bounds = { minX: 40, maxX: 680, minY: 900, maxY: 1200 };
const noKeys = { left: false, right: false, up: false, down: false };

describe("resolveTarget", () => {
  it("follows the pointer, clamped to bounds", () => {
    const t = resolveTarget({ x: 360, y: 1100 }, { pointer: { x: 9999, y: 9999 }, keys: noKeys }, 600, 0.016, bounds);
    expect(t.x).toBe(bounds.maxX);
    expect(t.y).toBe(bounds.maxY);
  });
  it("moves right with the right key when no pointer", () => {
    const t = resolveTarget({ x: 360, y: 1100 }, { pointer: null, keys: { ...noKeys, right: true } }, 600, 0.1, bounds);
    expect(t.x).toBeCloseTo(360 + 60, 3);
  });
  it("does not move below minY/above maxY with keys", () => {
    const t = resolveTarget({ x: 360, y: 1200 }, { pointer: null, keys: { ...noKeys, down: true } }, 600, 1, bounds);
    expect(t.y).toBe(bounds.maxY);
  });
});

describe("AutoFire", () => {
  it("emits one shot per interval", () => {
    const af = new AutoFire(0.2);
    expect(af.update(0.1)).toBe(0);
    expect(af.update(0.15)).toBe(1); // 0.25 total >= 0.2
  });
  it("emits multiple shots if a big dt elapses", () => {
    const af = new AutoFire(0.1);
    expect(af.update(0.35)).toBe(3);
  });
});
