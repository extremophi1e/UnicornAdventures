import { describe, it, expect } from "vitest";
import {
  initialCatchState, resetForEntry, recordCatch, recordMiss, speedForNotch,
  SPEED_TABLE, START_NOTCH, CATCHES_PER_STEP_UP, MISSES_PER_STEP_DOWN,
} from "./catch";

describe("catch difficulty model", () => {
  it("starts at START_NOTCH with zeroed counters", () => {
    expect(initialCatchState()).toEqual({ notch: START_NOTCH, catchCount: 0, missCount: 0 });
  });

  it("resetForEntry matches initial state", () => {
    expect(resetForEntry()).toEqual(initialCatchState());
  });

  it("does not change notch before the catch threshold", () => {
    let s = initialCatchState();
    for (let i = 0; i < CATCHES_PER_STEP_UP - 1; i++) s = recordCatch(s);
    expect(s.notch).toBe(START_NOTCH);
    expect(s.catchCount).toBe(CATCHES_PER_STEP_UP - 1);
  });

  it("steps up after CATCHES_PER_STEP_UP catches and resets counters", () => {
    let s = initialCatchState();
    for (let i = 0; i < CATCHES_PER_STEP_UP; i++) s = recordCatch(s);
    expect(s).toEqual({ notch: START_NOTCH + 1, catchCount: 0, missCount: 0 });
  });

  it("does not change notch before the miss threshold", () => {
    let s = initialCatchState();
    for (let i = 0; i < MISSES_PER_STEP_DOWN - 1; i++) s = recordMiss(s);
    expect(s.notch).toBe(START_NOTCH);
    expect(s.missCount).toBe(MISSES_PER_STEP_DOWN - 1);
  });

  it("steps down after MISSES_PER_STEP_DOWN misses and resets counters", () => {
    let s = initialCatchState();
    for (let i = 0; i < MISSES_PER_STEP_DOWN; i++) s = recordMiss(s);
    expect(s).toEqual({ notch: START_NOTCH - 1, catchCount: 0, missCount: 0 });
  });

  it("a down-step also clears accumulated catches (anti-thrash)", () => {
    let s = initialCatchState();
    for (let i = 0; i < CATCHES_PER_STEP_UP - 1; i++) s = recordCatch(s); // 4 catches, no step
    expect(s.catchCount).toBe(CATCHES_PER_STEP_UP - 1);
    for (let i = 0; i < MISSES_PER_STEP_DOWN; i++) s = recordMiss(s);     // 3 misses -> step down
    expect(s).toEqual({ notch: START_NOTCH - 1, catchCount: 0, missCount: 0 });
  });

  it("never rises above the top of the speed table", () => {
    let s = initialCatchState();
    for (let i = 0; i < CATCHES_PER_STEP_UP * (SPEED_TABLE.length + 4); i++) s = recordCatch(s);
    expect(s.notch).toBe(SPEED_TABLE.length - 1);
    expect(speedForNotch(s.notch)).toBe(SPEED_TABLE[SPEED_TABLE.length - 1]);
  });

  it("never drops below the bottom of the speed table", () => {
    let s = initialCatchState();
    for (let i = 0; i < MISSES_PER_STEP_DOWN * (SPEED_TABLE.length + 4); i++) s = recordMiss(s);
    expect(s.notch).toBe(0);
    expect(speedForNotch(s.notch)).toBe(SPEED_TABLE[0]);
  });

  it("speedForNotch clamps out-of-range indices", () => {
    expect(speedForNotch(-5)).toBe(SPEED_TABLE[0]);
    expect(speedForNotch(999)).toBe(SPEED_TABLE[SPEED_TABLE.length - 1]);
    expect(speedForNotch(START_NOTCH)).toBe(SPEED_TABLE[START_NOTCH]);
  });
});
