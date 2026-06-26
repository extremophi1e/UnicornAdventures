import { CUTE_TYPES } from "../core/types";

export const ATLAS_KEY = "openmoji";

// Logical key -> atlas frame name. (Frame names match keys for simplicity.)
export const SPRITE_FRAME: Record<string, string> = {
  unicorn: "unicorn",
  star: "star",
  sparkle: "sparkle",
  ...Object.fromEntries(CUTE_TYPES.map((t) => [t, t])),
};

export function frameFor(key: string): string {
  const f = SPRITE_FRAME[key];
  if (!f) throw new Error(`No sprite frame for key "${key}"`);
  return f;
}
