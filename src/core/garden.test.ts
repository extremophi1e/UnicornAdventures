import { describe, it, expect } from "vitest";
import {
  BLOOM_TARGET, TIER2_AT, TIER3_AT, TIER_PLANTS, NEWEST_WEIGHT,
  unlockedTier, pickTier, plantForTier, RELEASE_PROB, shouldRelease, isFull,
  spreadPosition,
} from "./garden";

describe("unlockedTier", () => {
  it("starts at tier 0 (flowers)", () => { expect(unlockedTier(0)).toBe(0); });
  it("unlocks bushes (tier 1) at TIER2_AT", () => {
    expect(unlockedTier(TIER2_AT - 1)).toBe(0);
    expect(unlockedTier(TIER2_AT)).toBe(1);
  });
  it("unlocks trees (tier 2) at TIER3_AT", () => {
    expect(unlockedTier(TIER3_AT - 1)).toBe(1);
    expect(unlockedTier(TIER3_AT)).toBe(2);
  });
});

describe("pickTier", () => {
  it("is always tier 0 before any unlock", () => {
    expect(pickTier(0, () => 0.99)).toBe(0);
    expect(pickTier(TIER2_AT - 1, () => 0.0)).toBe(0);
  });
  it("picks the newest tier when rng < NEWEST_WEIGHT", () => {
    expect(pickTier(TIER3_AT, () => NEWEST_WEIGHT - 0.01)).toBe(2);
  });
  it("falls back to a lower tier when rng >= NEWEST_WEIGHT", () => {
    // first rng() >= weight -> go lower; second rng() picks among 0..top-1
    const seq = [0.9, 0.0]; let i = 0;
    expect(pickTier(TIER3_AT, () => seq[i++])).toBe(0); // floor(0.0 * 2) = 0
  });
});

describe("plantForTier", () => {
  it("returns a key from the tier's pool", () => {
    expect(TIER_PLANTS[0]).toContain(plantForTier(0, () => 0));
    expect(TIER_PLANTS[2]).toContain(plantForTier(2, () => 0.99));
  });
});

describe("shouldRelease", () => {
  it("is more likely for higher tiers", () => {
    expect(RELEASE_PROB[2]).toBeGreaterThan(RELEASE_PROB[0]);
    expect(shouldRelease(2, () => RELEASE_PROB[2] - 0.001)).toBe(true);
    expect(shouldRelease(0, () => RELEASE_PROB[0] + 0.001)).toBe(false);
  });
});

describe("isFull", () => {
  it("is true at the bloom target", () => {
    expect(isFull(BLOOM_TARGET - 1)).toBe(false);
    expect(isFull(BLOOM_TARGET)).toBe(true);
  });
});

describe("spreadPosition", () => {
  const B = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  it("uses the tapped point as-is when nothing is nearby", () => {
    expect(spreadPosition(500, 500, [], 60, B, () => 0)).toEqual({ x: 500, y: 500 });
  });

  it("clamps the point inside the bounds", () => {
    expect(spreadPosition(-50, 1200, [], 60, B, () => 0)).toEqual({ x: 0, y: 1000 });
  });

  it("moves a tap that lands on top of a plant at least minDist away", () => {
    const p = spreadPosition(500, 500, [{ x: 500, y: 500 }], 60, B, () => 0);
    expect(dist(p, { x: 500, y: 500 })).toBeGreaterThanOrEqual(60 - 1e-6);
  });

  it("fans repeated same-spot taps out so none stack on a prior plant", () => {
    const minDist = 60;
    const placed: { x: number; y: number }[] = [];
    let seed = 1;
    const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 8; i++) {
      const p = spreadPosition(500, 500, placed, minDist, B, rng);
      for (const q of placed) expect(dist(p, q)).toBeGreaterThanOrEqual(minDist - 1);
      placed.push(p);
    }
    expect(placed).toHaveLength(8);
  });

  it("returns a best-effort spot (never throws) when the area is saturated", () => {
    const tiny = { minX: 0, maxX: 50, minY: 0, maxY: 50 };
    const existing = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 0, y: 50 }, { x: 50, y: 50 }, { x: 25, y: 25 }];
    const p = spreadPosition(25, 25, existing, 100, tiny, () => 0.5);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(50);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(50);
  });
});
