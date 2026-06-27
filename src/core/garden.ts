// Pure, framework-free logic for the Tap-to-Grow Garden mode (no Phaser import,
// unit-tested headlessly). Drives the flower→bush→tree maturity ladder, the
// pollinator-release roll, and the bloom trigger. All counts are "plants placed
// this round".

export type Tier = 0 | 1 | 2; // 0 flowers, 1 bushes, 2 trees

export const BLOOM_TARGET = 22;            // plants per round before the meadow blooms
export const TIER2_AT = Math.floor(BLOOM_TARGET / 3);       // bushes unlock (~7)
export const TIER3_AT = Math.floor((BLOOM_TARGET * 2) / 3); // trees unlock (~14)
export const NEWEST_WEIGHT = 0.6;          // chance a tap grows the newest-unlocked tier

// Emoji keys per tier (all baked in Task 1; `flower` 🌸 already existed).
export const TIER_PLANTS: readonly (readonly string[])[] = [
  ["flower", "daisy", "tulip", "rose"],   // tier 0 — flowers
  ["herb", "cactus"],                     // tier 1 — bushes (sunflower 404'd)
  ["evergreen"],                          // tier 2 — trees (tree 404'd)
];

// Pollinator-release probability per plant tier (rises with maturity).
export const RELEASE_PROB: readonly number[] = [0.12, 0.3, 0.6];

// Highest tier unlocked given how many plants are already placed this round.
export function unlockedTier(placed: number): Tier {
  if (placed >= TIER3_AT) return 2;
  if (placed >= TIER2_AT) return 1;
  return 0;
}

// Choose which tier this tap grows: weighted toward the newest unlocked tier so
// the meadow visibly "grows up", while older tiers keep appearing (layered meadow).
export function pickTier(placed: number, rng: () => number): Tier {
  const top = unlockedTier(placed);
  if (top === 0) return 0;
  if (rng() < NEWEST_WEIGHT) return top;
  return Math.min(top - 1, Math.floor(rng() * top)) as Tier;
}

// Random plant key from a tier's pool.
export function plantForTier(tier: Tier, rng: () => number): string {
  const pool = TIER_PLANTS[tier];
  return pool[Math.floor(rng() * pool.length)];
}

// Does a plant of this tier release a pollinator when it finishes growing?
export function shouldRelease(tier: Tier, rng: () => number): boolean {
  return rng() < RELEASE_PROB[tier];
}

// Has the meadow reached the bloom target?
export function isFull(placed: number): boolean {
  return placed >= BLOOM_TARGET;
}
