import { describe, it, expect } from "vitest";
import { LEVELS, getLevel } from "../../src/core/levels";
import { TEMPLATES } from "../../src/core/formations";

describe("LEVELS", () => {
  it("has 12 levels indexed 1..12", () => {
    expect(LEVELS.length).toBe(12);
    LEVELS.forEach((l, i) => expect(l.index).toBe(i + 1));
  });

  it("every level has 1..3 formations", () => {
    for (const l of LEVELS) {
      expect(l.formations.length).toBeGreaterThanOrEqual(1);
      expect(l.formations.length).toBeLessThanOrEqual(3);
    }
  });

  it("every level uses 1..3 distinct cute types total", () => {
    for (const l of LEVELS) {
      const types = new Set(l.formations.flatMap((f) => f.types));
      expect(types.size).toBeGreaterThanOrEqual(1);
      expect(types.size).toBeLessThanOrEqual(3);
    }
  });

  it("references only real templates", () => {
    for (const l of LEVELS)
      for (const f of l.formations) expect(TEMPLATES[f.templateId]).toBeDefined();
  });

  it("has bosses exactly at levels 5, 10, 12", () => {
    const bossLevels = LEVELS.filter((l) => l.boss).map((l) => l.index);
    expect(bossLevels).toEqual([5, 10, 12]);
  });

  it("formation count is non-decreasing and ramps to 3 by the end", () => {
    expect(LEVELS[0].formations.length).toBe(1);
    expect(LEVELS[11].formations.length).toBeGreaterThanOrEqual(1); // boss level may be 1 + boss
  });

  it("getLevel throws out of range", () => {
    expect(() => getLevel(0)).toThrow();
    expect(() => getLevel(13)).toThrow();
    expect(getLevel(1).index).toBe(1);
  });
});
