import type { CuteType, FormationTemplate, Rng, TypingRule } from "./types";

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
