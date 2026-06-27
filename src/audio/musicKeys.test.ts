import { describe, it, expect } from "vitest";
import { GAME_MUSIC } from "./musicKeys";

describe("per-game music playlists", () => {
  it("gives every game exactly 3 tracks", () => {
    for (const [game, keys] of Object.entries(GAME_MUSIC)) {
      expect(keys.length, `${game} should have 3 tracks`).toBe(3);
    }
  });
  it("has no duplicate key within a game", () => {
    for (const [game, keys] of Object.entries(GAME_MUSIC)) {
      expect(new Set(keys).size, `${game} has a duplicate key`).toBe(keys.length);
    }
  });
  it("shares no track key between games", () => {
    const seen = new Map<string, string>();
    for (const [game, keys] of Object.entries(GAME_MUSIC)) {
      for (const k of keys) {
        expect(seen.has(k), `${k} is used by both ${seen.get(k)} and ${game}`).toBe(false);
        seen.set(k, game);
      }
    }
  });
});
