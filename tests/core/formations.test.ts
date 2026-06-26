import { describe, it, expect } from "vitest";
import { TEMPLATES, assignTypes } from "../../src/core/formations";
import { createRng } from "../../src/core/rng";

describe("TEMPLATES", () => {
  it("exposes the required templates with non-empty, in-bounds cells", () => {
    for (const id of ["block3x3", "twoRows", "arch", "heart", "diamond", "vRows4"]) {
      const t = TEMPLATES[id];
      expect(t, id).toBeDefined();
      expect(t.cells.length).toBeGreaterThan(0);
      for (const c of t.cells) {
        expect(c.gx).toBeGreaterThanOrEqual(0);
        expect(c.gx).toBeLessThan(t.cols);
        expect(c.gy).toBeGreaterThanOrEqual(0);
        expect(c.gy).toBeLessThan(t.rows);
      }
    }
  });
});

describe("assignTypes", () => {
  const t = TEMPLATES.twoRows;

  it("returns one type per cell", () => {
    const out = assignTypes(t, "uniform", ["cupcake"], createRng(1));
    expect(out.length).toBe(t.cells.length);
  });

  it("uniform uses only the first type", () => {
    const out = assignTypes(t, "uniform", ["cupcake", "star"], createRng(1));
    expect(new Set(out)).toEqual(new Set(["cupcake"]));
  });

  it("byRow gives every cell in a row the same type", () => {
    const out = assignTypes(t, "byRow", ["cupcake", "star"], createRng(1));
    const byRow = new Map<number, Set<string>>();
    t.cells.forEach((c, i) => {
      const s = byRow.get(c.gy) ?? new Set();
      s.add(out[i]);
      byRow.set(c.gy, s);
    });
    for (const s of byRow.values()) expect(s.size).toBe(1);
  });

  it("only emits types from the provided list", () => {
    const out = assignTypes(t, "cluster", ["heart", "flower", "donut"], createRng(3));
    for (const ty of out) expect(["heart", "flower", "donut"]).toContain(ty);
  });
});
