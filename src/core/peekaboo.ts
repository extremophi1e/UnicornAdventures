// Pure, framework-free logic for the Peekaboo / Whack-a-Cutie mode. No Phaser or
// render imports — unit-tested headlessly. Difficulty reuses src/core/catch.ts's
// notch ladder; here we map a notch to the visible window + concurrency, lay out
// the fixed hiding spots, and choose which spot pops next.

export type SpotType = "burrow" | "flower" | "cloud";
export interface Spot { id: number; x: number; y: number; type: SpotType; }

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

// Fixed, responsive hiding-spot layout (deterministic — no rng). 2 clouds in the
// upper sky; 3 burrows + 2 flowers across the lower meadow. Kept clear of the top
// HUD band and the screen edges.
export function computeSpots(viewportW: number, viewportH: number): Spot[] {
  const X = (f: number) => clamp(Math.round(viewportW * f), 80, viewportW - 80);
  const Y = (f: number) => clamp(Math.round(viewportH * f), 150, viewportH - 120);
  const defs: { type: SpotType; fx: number; fy: number }[] = [
    { type: "cloud", fx: 0.26, fy: 0.25 },
    { type: "cloud", fx: 0.72, fy: 0.30 },
    { type: "burrow", fx: 0.20, fy: 0.70 },
    { type: "burrow", fx: 0.50, fy: 0.82 },
    { type: "burrow", fx: 0.80, fy: 0.70 },
    { type: "flower", fx: 0.34, fy: 0.90 },
    { type: "flower", fx: 0.66, fy: 0.90 },
  ];
  return defs.map((d, id) => ({ id, x: X(d.fx), y: Y(d.fy), type: d.type }));
}

// Visible dwell (ms) per difficulty notch — non-increasing (harder = shorter).
export const WINDOW_TABLE: readonly number[] = [2600, 2400, 2200, 2000, 1800, 1600, 1450, 1300];
// Max simultaneous critters per notch — non-decreasing, always >= 1.
export const CONCURRENT_TABLE: readonly number[] = [1, 1, 1, 2, 2, 2, 3, 3];

export function windowForNotch(notch: number): number {
  return WINDOW_TABLE[clamp(notch, 0, WINDOW_TABLE.length - 1)];
}
export function concurrentForNotch(notch: number): number {
  return CONCURRENT_TABLE[clamp(notch, 0, CONCURRENT_TABLE.length - 1)];
}

export const SURPRISE_CHANCE = 0.18; // fraction of pops that appear off-spot
export function shouldSurprise(rng: () => number): boolean {
  return rng() < SURPRISE_CHANCE;
}

// Pick a random idle spot id, avoiding an immediate repeat of lastId. Returns -1 if
// none are idle; if lastId is the only idle spot, returns it.
export function chooseSpot(idleIds: readonly number[], lastId: number, rng: () => number): number {
  if (idleIds.length === 0) return -1;
  const pref = idleIds.filter((id) => id !== lastId);
  const pool = pref.length ? pref : idleIds;
  return pool[Math.floor(rng() * pool.length)];
}
