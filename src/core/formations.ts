import type { CuteType, FormationTemplate, PlacedEnemy, Rng, TypingRule } from "./types";

function grid(id: string, cols: number, rows: number, mask: string[]): FormationTemplate {
  const cells: { gx: number; gy: number }[] = [];
  mask.forEach((line, gy) => {
    [...line].forEach((ch, gx) => {
      if (ch === "#") cells.push({ gx, gy });
    });
  });
  return { id, cols, rows, cells };
}

export const TEMPLATES: Record<string, FormationTemplate> = {
  block3x3: grid("block3x3", 3, 3, ["###", "###", "###"]),
  twoRows: grid("twoRows", 6, 2, ["######", "######"]),
  arch: grid("arch", 5, 3, [".###.", "#...#", "#...#"]),
  heart: grid("heart", 5, 4, [".#.#.", "#####", ".###.", "..#.."]),
  diamond: grid("diamond", 5, 5, ["..#..", ".###.", "#####", ".###.", "..#.."]),
  vRows4: grid("vRows4", 7, 4, ["#######", "#######", "#######", "#######"]),
  // --- new formations ---
  // V-shape / wedge pointing down
  vee: grid("vee", 7, 4, [
    "#.....#",
    ".#...#.",
    "..#.#..",
    "...#...",
  ]),
  // Three tall pillars
  pillars: grid("pillars", 7, 5, [
    "#.#.#.#",
    "#.#.#.#",
    "#.#.#.#",
    "#.#.#.#",
    "#.#.#.#",
  ]),
  // Hollow ring / frame
  ring: grid("ring", 5, 5, [
    "#####",
    "#...#",
    "#...#",
    "#...#",
    "#####",
  ]),
  // Zigzag across two rows
  zigzag: grid("zigzag", 7, 3, [
    "#.#.#.#",
    ".#.#.#.",
    "#.#.#.#",
  ]),
  // X / cross shape
  xshape: grid("xshape", 5, 5, [
    "#...#",
    ".#.#.",
    "..#..",
    ".#.#.",
    "#...#",
  ]),
  // Pyramid / triangle pointing up
  pyramid: grid("pyramid", 7, 4, [
    "...#...",
    "..###..",
    ".#####.",
    "#######",
  ]),
};

export function assignTypes(
  template: FormationTemplate,
  rule: TypingRule,
  types: CuteType[],
  rng: Rng,
): CuteType[] {
  const pool = types.length > 0 ? types : (["cupcake"] as CuteType[]);
  return template.cells.map((c, i) => {
    switch (rule) {
      case "uniform":
        return pool[0];
      case "byRow":
        return pool[c.gy % pool.length];
      case "byCol":
        return pool[c.gx % pool.length];
      case "cluster": {
        // Stable pseudo-random clustering by cell index, deterministic via rng seed offset.
        const r = Math.floor(rng() * pool.length);
        return pool[(r + i) % pool.length];
      }
    }
  });
}

export type Playfield = { width: number; height: number };

export function layoutFormation(
  template: FormationTemplate,
  assigned: CuteType[],
  field: Playfield,
  opts: { topMargin?: number; cellSize?: number } = {},
): PlacedEnemy[] {
  const baseCell = opts.cellSize ?? 110;
  const topMargin = opts.topMargin ?? 180;
  const FILL = 0.82;       // target fraction of width the formation should span on wide screens
  const MAX_FACTOR = 1.7;  // cap spread so small formations don't get too sparse
  const cols = template.cols;
  let xCell = baseCell;
  if (cols > 1) {
    const target = (field.width * FILL) / (cols - 1);
    xCell = Math.min(Math.max(target, baseCell), baseCell * MAX_FACTOR);
  }
  const totalWidth = (cols - 1) * xCell;
  const originX = (field.width - totalWidth) / 2;
  return template.cells.map((c, i) => ({
    pos: { x: originX + c.gx * xCell, y: topMargin + c.gy * baseCell },
    type: assigned[i],
  }));
}
