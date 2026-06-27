export type Vec2 = { x: number; y: number };

export type CuteType =
  | "cloud" | "cupcake" | "star" | "lollipop" | "icecream"
  | "balloon" | "flower" | "donut" | "butterfly"
  // Shooter-only enemy emoji (bugs + robot + poop + trex + jellyfish). Deliberately
  // NOT added to CUTE_TYPES below, which stays the OpenMoji-atlas cosmetic set
  // (render/sprites.ts). cloud + star are already in the union above.
  | "ant" | "snail" | "robot" | "poop" | "trex" | "jellyfish" | "microbe";

export const CUTE_TYPES: CuteType[] = [
  "cloud", "cupcake", "star", "lollipop", "icecream",
  "balloon", "flower", "donut", "butterfly",
];

export type DriftParams = { swayAmplitude: number; swaySpeed: number; descendSpeed: number };

export type FormationTemplate = {
  id: string;
  cols: number;
  rows: number;
  cells: { gx: number; gy: number }[];
};

export type TypingRule = "uniform" | "byRow" | "byCol" | "cluster";

export type FormationSpec = {
  templateId: string;
  typing: TypingRule;
  types: CuteType[];
  drift: DriftParams;
};

export type BossSpec = { type: CuteType; maxHp: number; phases: number };

export type Level = { index: number; formations: FormationSpec[]; boss?: BossSpec };

export type PlacedEnemy = { pos: Vec2; type: CuteType };

export type Rng = () => number;
