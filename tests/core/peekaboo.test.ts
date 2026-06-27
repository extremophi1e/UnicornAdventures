import { describe, it, expect } from "vitest";
import {
  computeSpots, windowForNotch, concurrentForNotch, chooseSpot, shouldSurprise,
  WINDOW_TABLE, CONCURRENT_TABLE, SURPRISE_CHANCE,
} from "../../src/core/peekaboo";

describe("computeSpots", () => {
  const spots = computeSpots(600, 1280);
  it("returns 7 spots with unique ids 0..6", () => {
    expect(spots).toHaveLength(7);
    expect(spots.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it("has 2 cloud, 3 burrow, 2 flower", () => {
    const count = (t: string) => spots.filter((s) => s.type === t).length;
    expect([count("cloud"), count("burrow"), count("flower")]).toEqual([2, 3, 2]);
  });
  it("keeps every spot inside safe bounds", () => {
    for (const s of spots) {
      expect(s.x).toBeGreaterThanOrEqual(80);
      expect(s.x).toBeLessThanOrEqual(520);
      expect(s.y).toBeGreaterThanOrEqual(150);
      expect(s.y).toBeLessThanOrEqual(1160);
    }
  });
  it("places clouds higher (smaller y) than all ground spots", () => {
    const clouds = spots.filter((s) => s.type === "cloud");
    const ground = spots.filter((s) => s.type !== "cloud");
    const maxCloudY = Math.max(...clouds.map((s) => s.y));
    const minGroundY = Math.min(...ground.map((s) => s.y));
    expect(maxCloudY).toBeLessThan(minGroundY);
  });
});

describe("difficulty lookups", () => {
  it("window is non-increasing and clamps", () => {
    for (let i = 1; i < WINDOW_TABLE.length; i++) expect(WINDOW_TABLE[i]).toBeLessThanOrEqual(WINDOW_TABLE[i - 1]);
    expect(windowForNotch(-5)).toBe(WINDOW_TABLE[0]);
    expect(windowForNotch(99)).toBe(WINDOW_TABLE[WINDOW_TABLE.length - 1]);
  });
  it("concurrent is non-decreasing, >=1, and clamps", () => {
    for (let i = 1; i < CONCURRENT_TABLE.length; i++) expect(CONCURRENT_TABLE[i]).toBeGreaterThanOrEqual(CONCURRENT_TABLE[i - 1]);
    expect(concurrentForNotch(-5)).toBe(CONCURRENT_TABLE[0]);
    expect(concurrentForNotch(99)).toBe(CONCURRENT_TABLE[CONCURRENT_TABLE.length - 1]);
    expect(concurrentForNotch(0)).toBeGreaterThanOrEqual(1);
  });
});

describe("chooseSpot", () => {
  it("returns -1 when none idle", () => expect(chooseSpot([], 3, Math.random)).toBe(-1));
  it("returns the only idle spot even if it is lastId", () => expect(chooseSpot([2], 2, Math.random)).toBe(2));
  it("avoids the last spot when alternatives exist", () => {
    expect(chooseSpot([1, 2, 3], 2, () => 0)).not.toBe(2);
    expect([1, 2, 3]).toContain(chooseSpot([1, 2, 3], 2, () => 0));
  });
});

describe("shouldSurprise", () => {
  it("fires below the chance, not at/above", () => {
    expect(shouldSurprise(() => SURPRISE_CHANCE - 0.01)).toBe(true);
    expect(shouldSurprise(() => SURPRISE_CHANCE)).toBe(false);
  });
});
