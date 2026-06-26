import { describe, it, expect } from "vitest";
import { TEMPLATES, assignTypes, layoutFormation } from "../../src/core/formations";
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

  it("ALL templates (including new ones) have non-empty, in-bounds cells", () => {
    for (const id of Object.keys(TEMPLATES)) {
      const t = TEMPLATES[id];
      expect(t, `${id} should be defined`).toBeDefined();
      expect(t.cells.length, `${id} should have cells`).toBeGreaterThan(0);
      for (const c of t.cells) {
        expect(c.gx, `${id} cell gx in bounds`).toBeGreaterThanOrEqual(0);
        expect(c.gx, `${id} cell gx < cols`).toBeLessThan(t.cols);
        expect(c.gy, `${id} cell gy in bounds`).toBeGreaterThanOrEqual(0);
        expect(c.gy, `${id} cell gy < rows`).toBeLessThan(t.rows);
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
    const out = assignTypes(t, "cluster", ["cupcake", "flower", "donut"], createRng(3));
    for (const ty of out) expect(["cupcake", "flower", "donut"]).toContain(ty);
  });
});

describe("layoutFormation", () => {
  const field = { width: 720, height: 1280 };

  it("returns one placed enemy per assigned type, preserving order", () => {
    const t = TEMPLATES.block3x3;
    const assigned = assignTypes(t, "uniform", ["star"], createRng(1));
    const placed = layoutFormation(t, assigned, field);
    expect(placed.length).toBe(t.cells.length);
    expect(placed[0].type).toBe("star");
  });

  it("keeps all enemies inside the playfield", () => {
    const t = TEMPLATES.vRows4;
    const assigned = assignTypes(t, "byRow", ["cloud", "flower"], createRng(1));
    const placed = layoutFormation(t, assigned, field);
    for (const p of placed) {
      expect(p.pos.x).toBeGreaterThanOrEqual(0);
      expect(p.pos.x).toBeLessThanOrEqual(field.width);
      expect(p.pos.y).toBeGreaterThanOrEqual(0);
      expect(p.pos.y).toBeLessThanOrEqual(field.height);
    }
  });

  it("centers horizontally — leftmost and rightmost margins are equal", () => {
    const t = TEMPLATES.twoRows;
    const assigned = assignTypes(t, "uniform", ["donut"], createRng(1));
    const placed = layoutFormation(t, assigned, field);
    const xs = placed.map((p) => p.pos.x);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    expect(Math.abs(left - (field.width - right))).toBeLessThan(1);
  });

  describe("aspect-aware widening (wide screens)", () => {
    const wideField = { width: 1100, height: 1280 };
    const t = TEMPLATES.twoRows;
    const assigned = assignTypes(t, "uniform", ["donut"], createRng(1));

    it("horizontal span at width 1100 is GREATER than at width 720", () => {
      const placedNarrow = layoutFormation(t, assigned, field);
      const placedWide = layoutFormation(t, assigned, wideField);

      const spanOf = (placed: ReturnType<typeof layoutFormation>) => {
        const xs = placed.map((p) => p.pos.x);
        return Math.max(...xs) - Math.min(...xs);
      };

      expect(spanOf(placedWide)).toBeGreaterThan(spanOf(placedNarrow));
    });

    it("stays centered at width 1100 (left margin ≈ right margin)", () => {
      const placed = layoutFormation(t, assigned, wideField);
      const xs = placed.map((p) => p.pos.x);
      const left = Math.min(...xs);
      const right = Math.max(...xs);
      expect(Math.abs(left - (wideField.width - right))).toBeLessThan(1);
    });

    it("stays fully in-bounds at width 1100", () => {
      const placed = layoutFormation(t, assigned, wideField);
      for (const p of placed) {
        expect(p.pos.x).toBeGreaterThanOrEqual(0);
        expect(p.pos.x).toBeLessThanOrEqual(wideField.width);
        expect(p.pos.y).toBeGreaterThanOrEqual(0);
        expect(p.pos.y).toBeLessThanOrEqual(wideField.height);
      }
    });
  });
});
