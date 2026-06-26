import type { CuteType, DriftParams, FormationSpec, Rng, TypingRule } from "./types";
import { CUTE_TYPES } from "./types";
import { TEMPLATES } from "./formations";
import { budgetForDepth, typeCountForDepth } from "./difficulty";
import { pick } from "./rng";

export const TEMPLATE_COST: Record<string, number> = {
  // original templates
  block3x3: 6, twoRows: 6, arch: 5, heart: 7, diamond: 6, vRows4: 10,
  // new templates (cost ≈ enemy-cell count / 3, kept in 5–10 range)
  vee:     7,  // 13 cells
  pillars: 10, // 20 cells
  ring:    8,  // 16 cells
  zigzag:  8,  // 15 cells
  xshape:  5,  // 9 cells
  pyramid: 7,  // 16 cells (1+3+5+7)
};
const TYPINGS: TypingRule[] = ["uniform", "byRow", "byCol", "cluster"];

export function generateRainbowWave(depth: number, rng: Rng): FormationSpec[] {
  let budget = budgetForDepth(depth);
  const nTypes = typeCountForDepth(depth);

  // Pick the palette for this wave deterministically.
  const palette: CuteType[] = [];
  while (palette.length < nTypes) {
    const t = pick(rng, CUTE_TYPES);
    if (!palette.includes(t)) palette.push(t);
  }

  const drift: DriftParams = {
    swayAmplitude: 40 + Math.min(depth * 2, 40),
    swaySpeed: 0.6 + Math.min(depth * 0.03, 0.6),
    descendSpeed: 0,
  };

  const ids = Object.keys(TEMPLATES);
  const formations: FormationSpec[] = [];
  while (formations.length < 3 && budget > 0) {
    const affordable = ids.filter((id) => TEMPLATE_COST[id] <= budget);
    if (affordable.length === 0) break;
    const id = pick(rng, affordable);
    budget -= TEMPLATE_COST[id];
    const typing = formations.length === 0 || palette.length === 1 ? "uniform" : pick(rng, TYPINGS);
    // Each formation uses 1..nTypes of the palette.
    const useCount = 1 + Math.floor(rng() * palette.length);
    formations.push({ templateId: id, typing, types: palette.slice(0, useCount), drift });
  }
  if (formations.length === 0) {
    formations.push({ templateId: "twoRows", typing: "uniform", types: [palette[0]], drift });
  }
  return formations;
}
