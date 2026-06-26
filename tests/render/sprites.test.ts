import { describe, it, expect } from "vitest";
import { SPRITE_FRAME, frameFor } from "../../src/render/sprites";
import { CUTE_TYPES } from "../../src/core/types";

describe("sprite map", () => {
  it("has a frame for every cute type plus unicorn, star, sparkle", () => {
    for (const t of CUTE_TYPES) expect(SPRITE_FRAME[t]).toBeDefined();
    for (const k of ["unicorn", "star", "sparkle"]) expect(SPRITE_FRAME[k]).toBeDefined();
  });
  it("frameFor throws on unknown key", () => {
    expect(() => frameFor("nope")).toThrow();
    expect(frameFor("cupcake")).toBe(SPRITE_FRAME["cupcake"]);
  });
});
