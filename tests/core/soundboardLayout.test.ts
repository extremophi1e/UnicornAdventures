import { describe, it, expect } from "vitest";
import { computeGrid, pageSlice } from "../../src/core/soundboardLayout";

describe("computeGrid", () => {
  it("packs a dense, tappable grid on a narrow phone (520x1280, 53 items)", () => {
    const g = computeGrid(520, 1280, 53);
    expect(g.cols).toBe(3);
    expect(g.rows).toBe(6);
    expect(g.perPage).toBe(18);
    expect(g.pages).toBe(3); // ceil(53/18)
    expect(g.cellSize).toBeGreaterThanOrEqual(132);
    expect(g.cellSize).toBeLessThanOrEqual(188);
    expect(g.cellCenters).toHaveLength(18);
  });

  it("uses more columns on a wide screen (1100x1280)", () => {
    const narrow = computeGrid(520, 1280, 53);
    const wide = computeGrid(1100, 1280, 53);
    expect(wide.cols).toBeGreaterThan(narrow.cols);
  });

  it("keeps every cell centre inside the content area", () => {
    const W = 600, H = 1280, margin = 24, top = 120, bottom = 150;
    const g = computeGrid(W, H, 53, { margin, topReserved: top, bottomReserved: bottom });
    for (const c of g.cellCenters) {
      expect(c.cx).toBeGreaterThanOrEqual(margin);
      expect(c.cx).toBeLessThanOrEqual(W - margin);
      expect(c.cy).toBeGreaterThanOrEqual(top);
      expect(c.cy).toBeLessThanOrEqual(H - bottom);
    }
  });

  it("covers all items: pages * perPage >= count, and always >= 1 page", () => {
    const g = computeGrid(520, 1280, 53);
    expect(g.pages * g.perPage).toBeGreaterThanOrEqual(53);
    expect(computeGrid(300, 400, 53).pages).toBeGreaterThanOrEqual(1);
    expect(computeGrid(300, 400, 53).cols).toBeGreaterThanOrEqual(1);
    expect(computeGrid(300, 400, 53).rows).toBeGreaterThanOrEqual(1);
  });
});

describe("pageSlice", () => {
  const items = Array.from({ length: 53 }, (_, i) => i);
  it("returns the page's window", () => {
    expect(pageSlice(items, 0, 18)).toEqual(items.slice(0, 18));
    expect(pageSlice(items, 1, 18)).toEqual(items.slice(18, 36));
  });
  it("returns the short tail on the last page", () => {
    expect(pageSlice(items, 2, 18)).toEqual(items.slice(36, 53)); // length 17
  });
});
