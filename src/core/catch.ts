// Pure, framework-free self-balancing speed model for Rainbow Catch.
// One global fall speed sits on a notch ladder: catching speeds it up, missing
// slows it down. Stepped (not per-event), clamped, and reset on entry — so it
// always drifts toward the child's current skill and can never run away.
// No Phaser imports: this module is unit-tested headlessly.

export const SPEED_TABLE: readonly number[] = [135, 180, 225, 278, 330, 390, 450, 510]; // px/s (base +50%)
export const START_NOTCH = 1;            // ~180 px/s on entry
export const CATCHES_PER_STEP_UP = 5;    // +1 notch every 5 catches
export const MISSES_PER_STEP_DOWN = 3;   // -1 notch every 3 misses

export interface CatchState {
  notch: number;
  catchCount: number;
  missCount: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

export function initialCatchState(): CatchState {
  return { notch: START_NOTCH, catchCount: 0, missCount: 0 };
}

// Called when the player (re)enters the mode.
export function resetForEntry(): CatchState {
  return initialCatchState();
}

export function recordCatch(s: CatchState): CatchState {
  const catchCount = s.catchCount + 1;
  if (catchCount >= CATCHES_PER_STEP_UP) {
    return { notch: clamp(s.notch + 1, 0, SPEED_TABLE.length - 1), catchCount: 0, missCount: 0 };
  }
  return { notch: s.notch, catchCount, missCount: s.missCount };
}

export function recordMiss(s: CatchState): CatchState {
  const missCount = s.missCount + 1;
  if (missCount >= MISSES_PER_STEP_DOWN) {
    return { notch: clamp(s.notch - 1, 0, SPEED_TABLE.length - 1), catchCount: 0, missCount: 0 };
  }
  return { notch: s.notch, catchCount: s.catchCount, missCount };
}

export function speedForNotch(notch: number): number {
  return SPEED_TABLE[clamp(notch, 0, SPEED_TABLE.length - 1)];
}
