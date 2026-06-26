import { describe, it, expect } from "vitest";
import { budgetForDepth, typeCountForDepth } from "../../src/core/difficulty";
import { generateRainbowWave } from "../../src/core/rainbow";
import { TEMPLATES } from "../../src/core/formations";
import { createRng } from "../../src/core/rng";

describe("difficulty", () => {
  it("budget is non-decreasing with depth", () => {
    for (let d = 1; d < 30; d++) {
      expect(budgetForDepth(d + 1)).toBeGreaterThanOrEqual(budgetForDepth(d));
    }
  });
  it("type count stays within 1..3", () => {
    for (let d = 1; d < 50; d++) {
      const n = typeCountForDepth(d);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });
});

describe("generateRainbowWave", () => {
  it("is deterministic for (depth, seed)", () => {
    const a = generateRainbowWave(5, createRng(99));
    const b = generateRainbowWave(5, createRng(99));
    expect(a).toEqual(b);
  });

  it("produces 1..3 coherent formations with real templates", () => {
    for (let d = 1; d < 20; d++) {
      const w = generateRainbowWave(d, createRng(d));
      expect(w.length).toBeGreaterThanOrEqual(1);
      expect(w.length).toBeLessThanOrEqual(3);
      for (const f of w) {
        expect(TEMPLATES[f.templateId]).toBeDefined();
        expect(f.types.length).toBeGreaterThanOrEqual(1);
        expect(f.types.length).toBeLessThanOrEqual(3);
      }
    }
  });
});
