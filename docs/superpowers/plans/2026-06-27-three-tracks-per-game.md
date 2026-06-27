# 3 Music Tracks Per Game Type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every game type that has background music exactly 3 tracks, each a unique recording, without deleting any existing track.

**Architecture:** Extract the per-game music-key arrays out of the Phaser-coupled `Sound` class into a pure `musicKeys.ts` module so the "3 unique per game" invariant is unit-testable in the node test env. Respace the surplus tracks from over-stocked games (Galaga, Catch) into the short ones (Garden, Pop, Gumball) by renaming their mp3 files. Download 3 fresh ambient tracks for Aquarium and convert its hand-rolled single-loop into the shared playlist.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest (node environment), Node `.mjs` build scripts using `https` + `@breezystack/lamejs`.

## Global Constraints

- Every game **with** background music has **exactly 3 tracks**, each a **unique recording** (no two games share a track). Soundboard has **no** music — out of scope.
- **No track is deleted.** Surplus tracks are respaced by renaming their mp3 files; only Aquarium downloads net-new tracks.
- An audio **key === the BootScene asset id === the mp3 filename stem** (e.g. key `"garden1"` ↔ `public/audio/garden1.mp3`).
- All music is **Kevin MacLeod / incompetech, CC-BY 4.0**. New/respaced tracks are documented in `public/audio/CREDITS.md`.
- Tests run in the **node** Vitest environment — any module imported by a test must be **Phaser-free**.
- Commit per task using **explicit `git add <paths>`**. Do **not** stage the pre-existing uncommitted change in `src/scenes/GardenScene.ts` (unrelated in-progress work).

### Final per-game playlists (target)

| Game | Keys | Tracks (recording) |
|---|---|---|
| Galaga | `music1`,`music2`,`music3` | Pixelland, Carefree, Monkeys Spinning Monkeys |
| Catch | `catch1`,`catch2`,`catch3` | Sneaky Adventure, Cheery Monday, Pleasant Porridge |
| Pop | `popmusic`,`popmusic2`,`popmusic3` | Wallpaper, Investigations, Beach Party |
| Gumball | `gumball`,`gumball2`,`gumball3` | The Builder, Itty Bitty 8 Bit, Bumbly March |
| Peekaboo | `peekaboo1`,`peekaboo2`,`peekaboo3` | Sneaky Snitch, Hyperfun, Quirky Dog |
| Garden | `garden1`,`garden2`,`garden3` | Fluffing a Duck, Happy Bee, Wholesome |
| Eggs | `eggsmusic`,`eggsmusic2`,`eggsmusic3` | Run Amok, The Curtain Rises, Barroom Ballet |
| Aquarium | `aquarium`,`aquarium2`,`aquarium3` | Deep Haze, Lightless Dawn, Anamalie |

### File renames (respace = git mv, byte-preserving)

| Old file | New file | Track |
|---|---|---|
| `music4.mp3` | `garden1.mp3` | Fluffing a Duck |
| `music5.mp3` | `garden2.mp3` | Happy Bee |
| `music6.mp3` | `garden3.mp3` | Wholesome |
| `catch4.mp3` | `popmusic3.mp3` | Beach Party |
| `catch5.mp3` | `gumball3.mp3` | Bumbly March |

---

## File Structure

- **Create** `src/audio/musicKeys.ts` — pure per-game key arrays + a `GAME_MUSIC` registry. No Phaser import.
- **Create** `src/audio/musicKeys.test.ts` — invariant test: each game has 3 keys; keys unique within and across games.
- **Create** `src/audio/musicAssets.test.ts` — asset guard: every key has a non-empty mp3; no two tracks are byte-identical.
- **Modify** `src/audio/sound.ts` — import `MUSIC_KEYS` from `musicKeys`, re-export the other playlists, drop the inline key definitions.
- **Modify** `src/scenes/BootScene.ts` — rename 5 audio loads, add `aquarium2`/`aquarium3`.
- **Modify** `src/scenes/AquariumScene.ts` — play `AQUARIUM_MUSIC_KEYS` via the shared playlist.
- **Modify** build scripts: `build-pop-audio.mjs`, `build-gumball-audio.mjs`, `build-aquarium-audio.mjs`, `build-garden-audio.mjs`, comment in `build-audio.mjs`.
- **Rename** 5 mp3s + **download** 3 mp3s in `public/audio/`; **update** `public/audio/CREDITS.md`.

---

## Task 1: Music-key registry module + invariant test

**Files:**
- Create: `src/audio/musicKeys.ts`
- Test: `src/audio/musicKeys.test.ts`
- Modify: `src/audio/sound.ts:1-11`
- Modify: `scripts/build-audio.mjs:7`, `scripts/build-audio.mjs:215` (stale comment)

**Interfaces:**
- Produces: `MUSIC_KEYS`, `CATCH_MUSIC_KEYS`, `POP_MUSIC_KEYS`, `GUMBALL_MUSIC_KEYS`, `PEEKABOO_MUSIC_KEYS`, `GARDEN_MUSIC_KEYS`, `EGGS_MUSIC_KEYS`, `AQUARIUM_MUSIC_KEYS` (each `readonly string[]` of length 3) and `GAME_MUSIC: Record<string, readonly string[]>`, all from `src/audio/musicKeys.ts`. `sound.ts` re-exports every `*_MUSIC_KEYS` name so existing scene imports keep working.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `src/audio/musicKeys.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- musicKeys`
Expected: FAIL — cannot resolve `./musicKeys` (module does not exist yet).

- [ ] **Step 3: Create the registry module**

Create `src/audio/musicKeys.ts`:
```ts
// Pure music-track key registry — no Phaser import, so the per-game invariant
// (exactly 3 unique tracks each) is unit-testable in the node test env.
// Each key equals the BootScene asset id and the mp3 filename stem in
// public/audio (e.g. "garden1" -> public/audio/garden1.mp3).

export const MUSIC_KEYS = ["music1", "music2", "music3"] as const;                    // Galaga shooter
export const CATCH_MUSIC_KEYS = ["catch1", "catch2", "catch3"] as const;             // Rainbow Catch
export const POP_MUSIC_KEYS = ["popmusic", "popmusic2", "popmusic3"] as const;       // Pop the Cuties
export const GUMBALL_MUSIC_KEYS = ["gumball", "gumball2", "gumball3"] as const;       // Unicorn Gumballs
export const PEEKABOO_MUSIC_KEYS = ["peekaboo1", "peekaboo2", "peekaboo3"] as const; // Peekaboo
export const GARDEN_MUSIC_KEYS = ["garden1", "garden2", "garden3"] as const;         // Tap-to-Grow Garden
export const EGGS_MUSIC_KEYS = ["eggsmusic", "eggsmusic2", "eggsmusic3"] as const;   // Surprise Eggs
export const AQUARIUM_MUSIC_KEYS = ["aquarium", "aquarium2", "aquarium3"] as const;  // Tap the Aquarium

// Every game that has background music -> its playlist. Soundboard is
// intentionally absent (tap-instrument, no music).
export const GAME_MUSIC: Record<string, readonly string[]> = {
  galaga: MUSIC_KEYS,
  catch: CATCH_MUSIC_KEYS,
  pop: POP_MUSIC_KEYS,
  gumball: GUMBALL_MUSIC_KEYS,
  peekaboo: PEEKABOO_MUSIC_KEYS,
  garden: GARDEN_MUSIC_KEYS,
  eggs: EGGS_MUSIC_KEYS,
  aquarium: AQUARIUM_MUSIC_KEYS,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- musicKeys`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `sound.ts` to consume the module**

In `src/audio/sound.ts`, replace lines 1-11 (the import + the inline key/const definitions, up to and including the `EGGS_MUSIC_KEYS` line) with:
```ts
import Phaser from "phaser";
import { MUSIC_KEYS } from "./musicKeys";

// Per-game playlists live in the Phaser-free musicKeys module; re-export them
// so scenes can keep importing the names from here.
export {
  CATCH_MUSIC_KEYS,
  POP_MUSIC_KEYS,
  GUMBALL_MUSIC_KEYS,
  PEEKABOO_MUSIC_KEYS,
  GARDEN_MUSIC_KEYS,
  EGGS_MUSIC_KEYS,
  AQUARIUM_MUSIC_KEYS,
} from "./musicKeys";

export const GARDEN_NOTE_COUNT = 11;
```
Leave the `const GIGGLE_KEYS = ...` line (old line 12) and the rest of the file unchanged. The `Sound` class keeps using `MUSIC_KEYS` as its default `_playlist` and `playMusic` default — now sourced from the import.

- [ ] **Step 6: Fix the stale comment in `build-audio.mjs`**

In `scripts/build-audio.mjs`, change both occurrences of `music1-4` to `music1-3`:
- Line ~7: `* Does NOT generate music1-4.mp3 — those are real royalty-free tracks` → `music1-3.mp3`
- Line ~215: `// NOTE: music1-4.mp3 are real royalty-free tracks ...` → `music1-3.mp3`

- [ ] **Step 7: Verify the whole suite and typecheck pass**

Run: `npm test`
Expected: PASS (all existing tests + the 3 new ones).
Run: `npx tsc --noEmit`
Expected: no errors (scene imports of `*_MUSIC_KEYS` still resolve via the re-exports).

- [ ] **Step 8: Commit**

```bash
git add src/audio/musicKeys.ts src/audio/musicKeys.test.ts src/audio/sound.ts scripts/build-audio.mjs
git commit -m "refactor(audio): extract per-game music keys + invariant test"
```

---

## Task 2: Respace Galaga surplus into Garden

**Files:**
- Rename: `public/audio/music4.mp3`→`garden1.mp3`, `music5.mp3`→`garden2.mp3`, `music6.mp3`→`garden3.mp3`
- Modify: `src/scenes/BootScene.ts:15-17`
- Modify: `scripts/build-garden-audio.mjs`
- Modify: `public/audio/CREDITS.md`

**Interfaces:**
- Consumes: `GARDEN_MUSIC_KEYS = ["garden1","garden2","garden3"]` (Task 1). `GardenScene` already calls `playMusic(GARDEN_MUSIC_KEYS, 0.3)` — no scene change.
- Produces: `public/audio/garden1.mp3`, `garden2.mp3`, `garden3.mp3`; BootScene loads for those keys.

- [ ] **Step 1: Rename the three surplus mp3s**

```bash
git mv public/audio/music4.mp3 public/audio/garden1.mp3
git mv public/audio/music5.mp3 public/audio/garden2.mp3
git mv public/audio/music6.mp3 public/audio/garden3.mp3
```

- [ ] **Step 2: Update BootScene loads**

In `src/scenes/BootScene.ts`, replace these three lines:
```ts
    this.load.audio("music4", ["audio/music4.mp3"]);
    this.load.audio("music5", ["audio/music5.mp3"]);
    this.load.audio("music6", ["audio/music6.mp3"]);
```
with:
```ts
    this.load.audio("garden1", ["audio/garden1.mp3"]);
    this.load.audio("garden2", ["audio/garden2.mp3"]);
    this.load.audio("garden3", ["audio/garden3.mp3"]);
```

- [ ] **Step 3: Add a reproducible music download to `build-garden-audio.mjs`**

In `scripts/build-garden-audio.mjs`, add this import right after the `import lamejs from "@breezystack/lamejs";` line:
```js
import https from "https";
```
Then replace the final line `main();` with:
```js
// ---- Garden's own 3-track playlist (CC-BY, Kevin MacLeod). Respaced from the
// shooter's surplus; kept downloadable here so the set reproduces. -----------
const TRACKS = [
  { file: "garden1.mp3", title: "Fluffing a Duck", url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fluffing%20a%20Duck.mp3" },
  { file: "garden2.mp3", title: "Happy Bee",       url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Happy%20Bee.mp3" },
  { file: "garden3.mp3", title: "Wholesome",       url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Wholesome.mp3" },
];
function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume(); download(res.headers.location, dest, redirects + 1).then(resolve, reject); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", (e) => { try { fs.unlinkSync(dest); } catch {} reject(e); });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
  });
}
async function downloadMusic() {
  for (const t of TRACKS) {
    process.stdout.write(`Downloading ${t.title} -> ${t.file} ... `);
    await download(t.url, path.join(OUT_DIR, t.file))
      .then(() => console.log("ok"))
      .catch((e) => console.error(`FAILED: ${e.message} — pick another gentle CC-BY track, update the URL + CREDITS.md`));
  }
}
main();
await downloadMusic();
```
(The script already imports `fs` and `path` and defines `OUT_DIR`, so the helper reuses them.)

- [ ] **Step 4: Update CREDITS.md**

In `public/audio/CREDITS.md`, change the `music4`/`music5`/`music6` rows so the **File** column reads `garden1.mp3`/`garden2.mp3`/`garden3.mp3` (titles stay Fluffing a Duck / Happy Bee / Wholesome; URLs unchanged).

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: PASS (no test references the old keys).
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add public/audio/garden1.mp3 public/audio/garden2.mp3 public/audio/garden3.mp3 \
        src/scenes/BootScene.ts scripts/build-garden-audio.mjs public/audio/CREDITS.md
git commit -m "feat(garden): respace shooter surplus into Garden's own 3 tracks"
```

---

## Task 3: Respace Catch surplus into Pop and Gumball

**Files:**
- Rename: `public/audio/catch4.mp3`→`popmusic3.mp3`, `catch5.mp3`→`gumball3.mp3`
- Modify: `src/scenes/BootScene.ts:30-31`
- Modify: `scripts/build-pop-audio.mjs` (full rewrite), `scripts/build-gumball-audio.mjs` (full rewrite)
- Modify: `public/audio/CREDITS.md`

**Interfaces:**
- Consumes: `POP_MUSIC_KEYS = ["popmusic","popmusic2","popmusic3"]`, `GUMBALL_MUSIC_KEYS = ["gumball","gumball2","gumball3"]` (Task 1). `PopScene`/`GumballScene` already pass these to `playMusic` — no scene change.
- Produces: `public/audio/popmusic3.mp3`, `gumball3.mp3`; BootScene loads for those keys.

- [ ] **Step 1: Rename the two surplus mp3s**

```bash
git mv public/audio/catch4.mp3 public/audio/popmusic3.mp3
git mv public/audio/catch5.mp3 public/audio/gumball3.mp3
```

- [ ] **Step 2: Update BootScene loads**

In `src/scenes/BootScene.ts`, replace these two lines:
```ts
    this.load.audio("catch4", ["audio/catch4.mp3"]);
    this.load.audio("catch5", ["audio/catch5.mp3"]);
```
with:
```ts
    this.load.audio("popmusic3", ["audio/popmusic3.mp3"]);
    this.load.audio("gumball3", ["audio/gumball3.mp3"]);
```

- [ ] **Step 3: Widen `build-pop-audio.mjs` to the full 3-track set**

Replace the entire contents of `scripts/build-pop-audio.mjs` with:
```js
/**
 * build-pop-audio.mjs
 * Downloads Pop the Cuties' 3-track playlist (CC-BY, Kevin MacLeod).
 * Output: public/audio/popmusic.mp3, popmusic2.mp3, popmusic3.mp3
 * Replace any file with your own track (keep the filename).
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-pop-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACKS = [
  { file: "popmusic.mp3",  title: "Wallpaper",      url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Wallpaper.mp3" },
  { file: "popmusic2.mp3", title: "Investigations", url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Investigations.mp3" },
  { file: "popmusic3.mp3", title: "Beach Party",    url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Beach%20Party.mp3" },
];

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume();
        download(res.headers.location, dest, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const out = createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", (e) => { try { unlinkSync(dest); } catch {} reject(e); });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
  });
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  for (const t of TRACKS) {
    process.stdout.write(`Downloading ${t.title} -> ${t.file} ... `);
    try { await download(t.url, join(OUT_DIR, t.file)); console.log("ok"); }
    catch (e) { console.error(`FAILED: ${e.message} — pick another upbeat CC-BY track and update the URL + CREDITS.md`); process.exitCode = 1; }
  }
}
main();
```

- [ ] **Step 4: Widen `build-gumball-audio.mjs` to the full 3-track set**

Replace the entire contents of `scripts/build-gumball-audio.mjs` with:
```js
/**
 * build-gumball-audio.mjs
 * Downloads Unicorn Gumballs' 3-track playlist (CC-BY, Kevin MacLeod).
 * Output: public/audio/gumball.mp3, gumball2.mp3, gumball3.mp3
 * Replace any file with your own track (keep the filename).
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-gumball-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACKS = [
  { file: "gumball.mp3",  title: "The Builder",      url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Builder.mp3" },
  { file: "gumball2.mp3", title: "Itty Bitty 8 Bit", url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Itty%20Bitty%208%20Bit.mp3" },
  { file: "gumball3.mp3", title: "Bumbly March",     url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bumbly%20March.mp3" },
];

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume();
        download(res.headers.location, dest, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const out = createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", (e) => { try { unlinkSync(dest); } catch {} reject(e); });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
  });
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  for (const t of TRACKS) {
    process.stdout.write(`Downloading ${t.title} -> ${t.file} ... `);
    try { await download(t.url, join(OUT_DIR, t.file)); console.log("ok"); }
    catch (e) { console.error(`FAILED: ${e.message} — pick another bouncy CC-BY track and update the URL + CREDITS.md`); process.exitCode = 1; }
  }
}
main();
```

- [ ] **Step 5: Update CREDITS.md**

In `public/audio/CREDITS.md`, change the `catch4.mp3` row's **File** column to `popmusic3.mp3` (title Beach Party) and the `catch5.mp3` row's **File** column to `gumball3.mp3` (title Bumbly March). URLs unchanged.

- [ ] **Step 6: Verify**

Run: `npm test`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add public/audio/popmusic3.mp3 public/audio/gumball3.mp3 src/scenes/BootScene.ts \
        scripts/build-pop-audio.mjs scripts/build-gumball-audio.mjs public/audio/CREDITS.md
git commit -m "feat(pop,gumball): respace Catch surplus into a 3rd track each"
```

---

## Task 4: Aquarium — 3 fresh ambient tracks + playlist conversion

**Files:**
- Modify: `scripts/build-aquarium-audio.mjs` (full rewrite)
- Download: `public/audio/aquarium.mp3` (overwrite), `aquarium2.mp3`, `aquarium3.mp3`
- Modify: `src/scenes/BootScene.ts:23`
- Modify: `src/scenes/AquariumScene.ts:5`, `src/scenes/AquariumScene.ts:71-83`
- Modify: `public/audio/CREDITS.md`

**Interfaces:**
- Consumes: `AQUARIUM_MUSIC_KEYS = ["aquarium","aquarium2","aquarium3"]` (Task 1); `Sound.playMusic(playlist, volume)` (existing).
- Produces: `public/audio/aquarium.mp3` (Deep Haze), `aquarium2.mp3` (Lightless Dawn), `aquarium3.mp3` (Anamalie); BootScene loads for `aquarium2`/`aquarium3`.

**Network note:** Step 2 requires outbound HTTPS to incompetech.com. The 3 URLs were verified live (HTTP 200) on 2026-06-27. If any 404s at run time, the script prints `FAILED`; substitute a verified-200 fallback (Pamgaea, Lobby Time, Sweeter Vermouth, Sunday Dub) in both the script and CREDITS.

- [ ] **Step 1: Rewrite `build-aquarium-audio.mjs` for the 3-track playlist**

Replace the entire contents of `scripts/build-aquarium-audio.mjs` with:
```js
/**
 * build-aquarium-audio.mjs
 * Downloads Tap the Aquarium's 3-track playlist (calm/ambient, CC-BY, Kevin MacLeod).
 * Output: public/audio/aquarium.mp3, aquarium2.mp3, aquarium3.mp3
 * Replace any file with your own track (keep the filename).
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-aquarium-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACKS = [
  { file: "aquarium.mp3",  title: "Deep Haze",      url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Deep%20Haze.mp3" },
  { file: "aquarium2.mp3", title: "Lightless Dawn", url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lightless%20Dawn.mp3" },
  { file: "aquarium3.mp3", title: "Anamalie",       url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Anamalie.mp3" },
];

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume();
        download(res.headers.location, dest, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const out = createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", (e) => { try { unlinkSync(dest); } catch {} reject(e); });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
  });
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  for (const t of TRACKS) {
    process.stdout.write(`Downloading ${t.title} -> ${t.file} ... `);
    try { await download(t.url, join(OUT_DIR, t.file)); console.log("ok"); }
    catch (e) { console.error(`FAILED: ${e.message} — pick another calm CC-BY track and update the URL + CREDITS.md`); process.exitCode = 1; }
  }
}
main();
```

- [ ] **Step 2: Download the 3 tracks**

Run: `npm run aquarium-audio`
Expected: three `Downloading ... ok` lines; `public/audio/aquarium.mp3` overwritten and `aquarium2.mp3`, `aquarium3.mp3` created. Confirm all three are non-empty:
Run: `ls -l public/audio/aquarium*.mp3`

- [ ] **Step 3: Add BootScene loads for the two new tracks**

In `src/scenes/BootScene.ts`, find:
```ts
    this.load.audio("aquarium", ["audio/aquarium.mp3"]);
```
and add immediately after it:
```ts
    this.load.audio("aquarium2", ["audio/aquarium2.mp3"]);
    this.load.audio("aquarium3", ["audio/aquarium3.mp3"]);
```

- [ ] **Step 4: Import the playlist into AquariumScene**

In `src/scenes/AquariumScene.ts`, change line 5 from:
```ts
import { Sound } from "../audio/sound";
```
to:
```ts
import { Sound, AQUARIUM_MUSIC_KEYS } from "../audio/sound";
```

- [ ] **Step 5: Convert the single-loop to the shared playlist**

In `src/scenes/AquariumScene.ts`, replace this block:
```ts
    // Dedicated looping music (quieter so SFX stay crisp). Robust autoplay
    // (immediate + delayed retry + unlock/first-tap), stopped on shutdown.
    const music = this.sound.add("aquarium", { loop: true, volume: 0.38 });
    const startMusic = () => { if (!music.isPlaying) music.play(); };
    startMusic();
    this.time.delayedCall(200, startMusic);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    this.input.once("pointerdown", startMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tweens.killAll();
      this.time.removeAllEvents();
      music.stop();
      this.sound.stopAll();
```
with:
```ts
    // Dedicated 3-track playlist (quieter so SFX stay crisp). Robust autoplay
    // (immediate + delayed retry + unlock/first-tap), started exactly once.
    let musicStarted = false;
    const startMusic = () => {
      if (musicStarted) return;
      musicStarted = true;
      this.sound2.playMusic(AQUARIUM_MUSIC_KEYS, 0.38);
    };
    startMusic();
    this.time.delayedCall(200, startMusic);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    this.input.once("pointerdown", startMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.sound.stopAll();
```
(`this.sound.stopAll()` already stops the current playlist track; Phaser fires `"complete"` only on natural end, not on stop, so the playlist does not chain after shutdown. The `this.fish`-iteration warning comment further down in the handler stays untouched.)

- [ ] **Step 6: Update CREDITS.md**

In `public/audio/CREDITS.md`: retitle the `aquarium.mp3` row from Carefree to **Deep Haze** (URL `.../Deep%20Haze.mp3`); add two rows — `aquarium2.mp3` **Lightless Dawn** (`.../Lightless%20Dawn.mp3`) and `aquarium3.mp3` **Anamalie** (`.../Anamalie.mp3`), all CC-BY 4.0.

- [ ] **Step 7: Verify**

Run: `npm test`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-aquarium-audio.mjs public/audio/aquarium.mp3 public/audio/aquarium2.mp3 \
        public/audio/aquarium3.mp3 src/scenes/BootScene.ts src/scenes/AquariumScene.ts public/audio/CREDITS.md
git commit -m "feat(aquarium): 3 unique ambient tracks via the shared playlist"
```

---

## Task 5: Asset guard test + full verification

**Files:**
- Test: `src/audio/musicAssets.test.ts`

**Interfaces:**
- Consumes: `GAME_MUSIC` (Task 1) and the renamed/downloaded mp3s in `public/audio/` (Tasks 2-4).

- [ ] **Step 1: Write the asset guard test**

Create `src/audio/musicAssets.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the asset guard test**

Run: `npm test -- musicAssets`
Expected: PASS (24 files present, all distinct). If the uniqueness test fails on `aquarium`/`music2`, the Carefree dup was not swapped — re-run Task 4 Step 2.

- [ ] **Step 3: Run the full suite + production build**

Run: `npm test`
Expected: PASS (all suites).
Run: `npm run build`
Expected: `tsc --noEmit` clean, `vite build` succeeds.

- [ ] **Step 4: Manual smoke check (optional but recommended)**

Run: `npm run dev`, open the app, and visit each game. Confirm Aquarium music advances through more than one track over time and Garden's bed sounds different from Peekaboo. Stop the server when done.

- [ ] **Step 5: Commit**

```bash
git add src/audio/musicAssets.test.ts
git commit -m "test(audio): guard 3-unique-tracks-per-game at the asset level"
```

---

## Self-Review

- **Spec coverage:** Galaga/Catch trim → keys in Task 1; Garden own tracks → Task 2; Pop/Gumball 3rd track → Task 3; Aquarium 3 unique + playlist + Carefree swap → Task 4; Soundboard untouched (no task, intentional); "no deletion" → all moves are `git mv`; per-game uniqueness → Tasks 1 (keys) + 5 (recordings). ✓
- **Placeholder scan:** No TBD/TODO; every code step shows full content. ✓
- **Type consistency:** `*_MUSIC_KEYS` names defined in `musicKeys.ts` (Task 1), re-exported by `sound.ts` (Task 1), imported by `AquariumScene` (Task 4); `GAME_MUSIC` used in both test files; `playMusic(playlist, volume)` matches the existing `Sound` signature. ✓
