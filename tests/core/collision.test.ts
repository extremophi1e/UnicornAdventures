import { describe, it, expect } from "vitest";
import { circleOverlap, findStarEnemyHits } from "../../src/core/collision";

describe("circleOverlap", () => {
  it("true when overlapping", () => {
    expect(circleOverlap({ x: 0, y: 0, r: 10 }, { x: 5, y: 0, r: 10 })).toBe(true);
  });
  it("false when apart", () => {
    expect(circleOverlap({ x: 0, y: 0, r: 5 }, { x: 100, y: 0, r: 5 })).toBe(false);
  });
});

describe("findStarEnemyHits", () => {
  it("matches stars to overlapping enemies", () => {
    const stars = [{ x: 0, y: 0, r: 8 }, { x: 200, y: 0, r: 8 }];
    const enemies = [{ x: 5, y: 0, r: 20 }, { x: 205, y: 0, r: 20 }];
    const hits = findStarEnemyHits(stars, enemies);
    expect(hits).toEqual([
      { starIndex: 0, enemyIndex: 0 },
      { starIndex: 1, enemyIndex: 1 },
    ]);
  });
  it("consumes each star at most once", () => {
    const stars = [{ x: 0, y: 0, r: 8 }];
    const enemies = [{ x: 0, y: 0, r: 20 }, { x: 1, y: 0, r: 20 }];
    expect(findStarEnemyHits(stars, enemies).length).toBe(1);
  });
  it("returns nothing when nothing overlaps", () => {
    expect(findStarEnemyHits([{ x: 0, y: 0, r: 1 }], [{ x: 999, y: 0, r: 1 }])).toEqual([]);
  });
});
