import type { CuteType, DriftParams, FormationSpec, Level } from "./types";

const calm: DriftParams = { swayAmplitude: 40, swaySpeed: 0.6, descendSpeed: 0 };
const livelier: DriftParams = { swayAmplitude: 60, swaySpeed: 0.9, descendSpeed: 0 };

function f(
  templateId: string,
  typing: FormationSpec["typing"],
  types: CuteType[],
  drift: DriftParams = calm,
): FormationSpec {
  return { templateId, typing, types, drift };
}

export const LEVELS: Level[] = [
  // 1: gentle intro — one type, one formation
  { index: 1, formations: [f("twoRows", "uniform", ["cloud"])] },
  // 2: pyramid shape intro
  { index: 2, formations: [f("pyramid", "uniform", ["cupcake"])] },
  // 3: vee formation meets arch — two types
  { index: 3, formations: [f("vee", "uniform", ["star"]), f("arch", "uniform", ["lollipop"])] },
  // 4: zigzag rows + diamond
  { index: 4, formations: [f("zigzag", "byRow", ["icecream", "balloon"]), f("diamond", "uniform", ["star"])] },
  // 5: BOSS — giant cupcake
  {
    index: 5,
    formations: [f("twoRows", "uniform", ["cupcake"])],
    boss: { type: "cupcake", maxHp: 18, phases: 2 },
  },
  // 6: heart + ring (hollow frame)
  { index: 6, formations: [f("heart", "uniform", ["flower"]), f("ring", "byCol", ["donut", "flower"])] },
  // 7: pillars + xshape + twoRows
  {
    index: 7,
    formations: [
      f("pillars", "byCol", ["donut", "star"]),
      f("xshape", "uniform", ["star"]),
      f("twoRows", "byRow", ["donut", "star"], livelier),
    ],
  },
  // 8: ring + zigzag + pyramid
  {
    index: 8,
    formations: [
      f("ring", "cluster", ["butterfly", "flower"]),
      f("zigzag", "byRow", ["butterfly", "flower"]),
      f("pyramid", "uniform", ["flower"], livelier),
    ],
  },
  // 9: xshape + vee + pillars — three lively shapes
  {
    index: 9,
    formations: [
      f("xshape", "byRow", ["flower", "star"]),
      f("vee", "byCol", ["star", "flower"]),
      f("pillars", "uniform", ["cupcake"], livelier),
    ],
  },
  // 10: BOSS — giant cloud
  {
    index: 10,
    formations: [f("vRows4", "byRow", ["cloud", "star"], livelier)],
    boss: { type: "cloud", maxHp: 26, phases: 2 },
  },
  // 11: pre-finale — pyramid + ring + vee, three types
  {
    index: 11,
    formations: [
      f("pyramid", "uniform", ["icecream"], livelier),
      f("ring", "cluster", ["icecream", "donut", "flower"], livelier),
      f("vee", "byRow", ["flower", "donut"], livelier),
    ],
  },
  // 12: FINAL BOSS — giant star
  {
    index: 12,
    formations: [f("vRows4", "cluster", ["star", "balloon", "flower"], livelier)],
    boss: { type: "star", maxHp: 36, phases: 2 },
  },
];

export function getLevel(index: number): Level {
  const l = LEVELS.find((x) => x.index === index);
  if (!l) throw new Error(`No level ${index}`);
  return l;
}
