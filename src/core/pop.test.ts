import { describe, it, expect } from "vitest";
import { pickNearestWithinRadius, shouldSpawnBonus, BONUS_MIN_GAP, BONUS_CHANCE } from "./pop";

describe("pickNearestWithinRadius", () => {
  it("returns -1 for an empty list", () => {
    expect(pickNearestWithinRadius(0, 0, [], 100)).toBe(-1);
  });
  it("returns -1 when every target is outside the radius", () => {
    const targets = [{ x: 200, y: 0 }, { x: 0, y: 300 }];
    expect(pickNearestWithinRadius(0, 0, targets, 100)).toBe(-1);
  });
  it("returns the nearest index among several inside the radius", () => {
    const targets = [{ x: 90, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }];
    expect(pickNearestWithinRadius(0, 0, targets, 100)).toBe(1);
  });
  it("breaks ties by lowest index", () => {
    const targets = [{ x: 50, y: 0 }, { x: 0, y: 50 }];
    expect(pickNearestWithinRadius(0, 0, targets, 100)).toBe(0);
  });
  it("counts a target exactly on the radius as a hit", () => {
    const targets = [{ x: 100, y: 0 }];
    expect(pickNearestWithinRadius(0, 0, targets, 100)).toBe(0);
  });
});

describe("shouldSpawnBonus", () => {
  it("is false while below the minimum gap, even with a tiny rng", () => {
    expect(shouldSpawnBonus(BONUS_MIN_GAP - 1, () => 0)).toBe(false);
  });
  it("is true at/after the gap when rng is below the chance", () => {
    expect(shouldSpawnBonus(BONUS_MIN_GAP, () => BONUS_CHANCE - 0.001)).toBe(true);
  });
  it("is false at/after the gap when rng is at/above the chance", () => {
    expect(shouldSpawnBonus(BONUS_MIN_GAP + 5, () => BONUS_CHANCE)).toBe(false);
  });
});
