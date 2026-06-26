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
  // 2
  { index: 2, formations: [f("block3x3", "uniform", ["cupcake"])] },
  // 3: two formations, two types
  { index: 3, formations: [f("twoRows", "uniform", ["star"]), f("arch", "uniform", ["lollipop"])] },
  // 4: byRow mixing two types
  { index: 4, formations: [f("vRows4", "byRow", ["icecream", "balloon"]), f("diamond", "uniform", ["star"])] },
  // 5: BOSS — giant cupcake
  {
    index: 5,
    formations: [f("twoRows", "uniform", ["cupcake"])],
    boss: { type: "cupcake", maxHp: 18, phases: 2 },
  },
  // 6
  { index: 6, formations: [f("heart", "uniform", ["heart"]), f("twoRows", "byCol", ["heart", "flower"])] },
  // 7: three formations
  {
    index: 7,
    formations: [
      f("block3x3", "uniform", ["donut"]),
      f("arch", "uniform", ["star"]),
      f("twoRows", "byRow", ["donut", "star"], livelier),
    ],
  },
  // 8
  {
    index: 8,
    formations: [
      f("vRows4", "cluster", ["butterfly", "flower"]),
      f("diamond", "uniform", ["butterfly"]),
      f("twoRows", "uniform", ["flower"], livelier),
    ],
  },
  // 9
  {
    index: 9,
    formations: [
      f("heart", "byRow", ["heart", "star"]),
      f("vRows4", "byCol", ["star", "heart"]),
      f("arch", "uniform", ["cupcake"], livelier),
    ],
  },
  // 10: BOSS — giant cloud
  {
    index: 10,
    formations: [f("vRows4", "byRow", ["cloud", "star"], livelier)],
    boss: { type: "cloud", maxHp: 26, phases: 2 },
  },
  // 11: pre-finale, three lively formations, three types
  {
    index: 11,
    formations: [
      f("diamond", "uniform", ["icecream"], livelier),
      f("vRows4", "cluster", ["icecream", "donut", "heart"], livelier),
      f("heart", "byRow", ["heart", "donut"], livelier),
    ],
  },
  // 12: FINAL BOSS — giant star
  {
    index: 12,
    formations: [f("vRows4", "cluster", ["star", "balloon", "heart"], livelier)],
    boss: { type: "star", maxHp: 36, phases: 2 },
  },
];

export function getLevel(index: number): Level {
  const l = LEVELS.find((x) => x.index === index);
  if (!l) throw new Error(`No level ${index}`);
  return l;
}
