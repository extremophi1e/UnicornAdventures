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

export interface Pt { x: number; y: number; }

// Pick a spot for a new plant near (x, y) that doesn't stack on existing plants.
// If the tapped point is already at least `minDist` from every plant, it's used
// as-is. Otherwise we search outward in expanding rings for the nearest free spot
// (so plants still appear near the finger, just fanned out). If the meadow is too
// crowded to find a clear spot, the least-crowded nearby candidate is returned
// (best effort — growth is never blocked). Always clamped inside `bounds`.
export function spreadPosition(
  x: number,
  y: number,
  existing: readonly Pt[],
  minDist: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  rng: () => number,
): Pt {
  const clampX = (v: number) => Math.max(bounds.minX, Math.min(bounds.maxX, v));
  const clampY = (v: number) => Math.max(bounds.minY, Math.min(bounds.maxY, v));
  const nearestD2 = (px: number, py: number): number => {
    let best = Infinity;
    for (const p of existing) {
      const dx = p.x - px, dy = p.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
    return best;
  };
  const d2min = minDist * minDist;

  const sx = clampX(x), sy = clampY(y);
  if (nearestD2(sx, sy) >= d2min) return { x: sx, y: sy };

  let best: Pt = { x: sx, y: sy };
  let bestD2 = nearestD2(sx, sy);
  const RINGS = 6, PER_RING = 8;
  for (let ring = 1; ring <= RINGS; ring++) {
    const r = minDist * ring;
    const a0 = rng() * Math.PI * 2; // random start angle: repeated taps fan out in varied directions
    for (let k = 0; k < PER_RING; k++) {
      const a = a0 + (Math.PI * 2 * k) / PER_RING;
      const cx = clampX(x + Math.cos(a) * r);
      const cy = clampY(y + Math.sin(a) * r);
      const d2 = nearestD2(cx, cy);
      if (d2 >= d2min) return { x: cx, y: cy };
      if (d2 > bestD2) { bestD2 = d2; best = { x: cx, y: cy }; }
    }
  }
  return best;
}
