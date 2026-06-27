import { describe, it, expect } from "vitest";
import {
  Tier, BLOOM_TARGET, TIER2_AT, TIER3_AT, TIER_PLANTS, NEWEST_WEIGHT,
  unlockedTier, pickTier, plantForTier, RELEASE_PROB, shouldRelease, isFull,
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
