// @ts-nocheck — node-only test (fs/crypto/process). The project's tsconfig
// restricts `types` to vitest/globals (no @types/node), so the build's tsc would
// reject these imports; vitest runs the file in a real node env regardless.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { GAME_MUSIC } from "./musicKeys";

const AUDIO_DIR = join(process.cwd(), "public", "audio");
const allKeys = Object.values(GAME_MUSIC).flat();

describe("music assets", () => {
  it("has a non-empty mp3 for every game track key", () => {
    for (const key of allKeys) {
      const file = join(AUDIO_DIR, `${key}.mp3`);
      expect(existsSync(file), `${file} should exist`).toBe(true);
      expect(readFileSync(file).length, `${key}.mp3 should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("uses a unique recording per game track (no byte-identical duplicates)", () => {
    const byHash = new Map<string, string>();
    for (const key of allKeys) {
      const hash = createHash("md5").update(readFileSync(join(AUDIO_DIR, `${key}.mp3`))).digest("hex");
      expect(byHash.has(hash), `${key}.mp3 duplicates ${byHash.get(hash)}.mp3`).toBe(false);
      byHash.set(hash, key);
    }
  });
});
