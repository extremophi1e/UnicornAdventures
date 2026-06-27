import { describe, it, expect } from "vitest";
import { nextStage, isHatched, TAPS_TO_HATCH, CLUTCH_SIZE, type Stage } from "../../src/core/eggs";

describe("eggs core — crack FSM", () => {
  it("walks intact -> crack1 -> crack2 -> burst", () => {
    expect(nextStage("intact")).toBe("crack1");
    expect(nextStage("crack1")).toBe("crack2");
    expect(nextStage("crack2")).toBe("burst");
  });

  it("burst is terminal (idempotent) — extra/simultaneous taps are safe", () => {
    expect(nextStage("burst")).toBe("burst");
  });

  it("reaches burst in exactly TAPS_TO_HATCH taps, not before", () => {
    let stage: Stage = "intact";
    for (let i = 0; i < TAPS_TO_HATCH - 1; i++) stage = nextStage(stage);
    expect(stage).toBe("crack2");        // still cracking at TAPS-1
    expect(isHatched(stage)).toBe(false);
    stage = nextStage(stage);            // the 3rd tap
    expect(stage).toBe("burst");
    expect(isHatched(stage)).toBe(true);
  });

  it("isHatched is true only for burst", () => {
    expect(isHatched("intact")).toBe(false);
    expect(isHatched("crack1")).toBe(false);
    expect(isHatched("crack2")).toBe(false);
    expect(isHatched("burst")).toBe(true);
  });

  it("constants are the values the scene + copy rely on", () => {
    expect(TAPS_TO_HATCH).toBe(3);
    expect(CLUTCH_SIZE).toBe(5);
  });
});
