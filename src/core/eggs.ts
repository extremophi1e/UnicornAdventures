// Pure, framework-free crack FSM for Surprise Eggs. No Phaser / render imports;
// unit-tested headlessly. The egg advances one stage per tap; contents and the
// nearest-tap hit-test are reused from gumballs.ts / pop.ts in the scene.

// intact --tap--> crack1 --tap--> crack2 --tap--> burst.
export type Stage = "intact" | "crack1" | "crack2" | "burst";

export const TAPS_TO_HATCH = 3; // taps from intact to burst
export const CLUTCH_SIZE = 4;   // eggs visible at once (one per nest slot)

const ORDER: readonly Stage[] = ["intact", "crack1", "crack2", "burst"];

// Advance one crack stage on a tap. `burst` is terminal (idempotent), so a stray
// or simultaneous extra tap on an already-hatched egg is a harmless no-op.
export function nextStage(stage: Stage): Stage {
  const i = ORDER.indexOf(stage);
  return i < 0 || i >= ORDER.length - 1 ? "burst" : ORDER[i + 1];
}

// True once the egg has fully hatched (reached burst).
export function isHatched(stage: Stage): boolean {
  return stage === "burst";
}
