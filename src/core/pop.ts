// Pure, framework-free helpers for Pop the Cuties (tap-to-pop). No Phaser
// imports: unit-tested headlessly. The float speed/difficulty is shared with
// src/core/catch.ts (a pop = recordCatch, an escape = recordMiss).

export interface TargetLike { x: number; y: number; }

// Index of the nearest target within `radius` of (px,py), or -1 if none.
// Ties resolved by lowest index. Uses squared distance (no sqrt needed).
export function pickNearestWithinRadius(
  px: number, py: number, targets: readonly TargetLike[], radius: number,
): number {
  const r2 = radius * radius;
  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < targets.length; i++) {
    const dx = targets[i].x - px;
    const dy = targets[i].y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && d2 < bestD2) { bestD2 = d2; best = i; }
  }
  return best;
}

export const BONUS_MIN_GAP = 12;   // spawns since last bonus before eligible
export const BONUS_CHANCE = 0.08;  // per-eligible-spawn probability (~1 in 12.5)

// Pure bonus-spawn decision. `rng` returns a number in [0,1) (scene passes
// Math.random; tests pass a stub). Enforces a minimum gap so the rainbow
// bonus is a periodic surprise, never back-to-back.
export function shouldSpawnBonus(spawnsSinceBonus: number, rng: () => number): boolean {
  if (spawnsSinceBonus < BONUS_MIN_GAP) return false;
  return rng() < BONUS_CHANCE;
}
