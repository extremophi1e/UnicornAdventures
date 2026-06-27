# 3 Music Tracks Per Game Type — Implementation Plan (v2, AUDIO_FILES model)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **REVISED for the lazy-load refactor.** This plan targets the `AUDIO_FILES` /
> on-demand-streaming asset system in `src/render/assets.ts`. Before executing,
> confirm exact line numbers and function signatures against the **committed**
> refactor — it was uncommitted WIP when this plan was written and may have shifted.

**Goal:** Give every game type that has background music exactly 3 tracks, each a unique recording, without deleting any existing track.

**Architecture:** Extract the per-game music-key arrays out of the Phaser-coupled `Sound` class into a pure `musicKeys.ts` module so the "3 unique per game" invariant is unit-testable in the node test env. Respace surplus tracks from over-stocked games (Galaga, Catch) into short ones (Garden, Pop, Gumball) by renaming their mp3 files and their `AUDIO_FILES` entries. Download 3 fresh ambient tracks for Aquarium and convert its hand-rolled single-loop into the shared playlist via `preloadFirstTrack` + `playMusic`.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest (node environment), Node `.mjs` build scripts using `https` + `@breezystack/lamejs`.

## How the new audio system works (read before starting)

- `src/render/assets.ts` exports `AUDIO_FILES: Record<string, string[]>` — the **single source of truth** mapping every audio key to its file(s). A music key **not** in `AUDIO_FILES` silently fails to load (`ensureAudioLoaded` no-ops) and never plays. Adding a new track = add an `AUDIO_FILES` entry.
- Music streams per-track on demand: `Sound._playTrack` calls `ensureAudioLoaded(scene, key, …)` right before play, and prefetches the next track during playback.
- A scene queues its **first** track in `preload()` via `preloadFirstTrack(this, PLAYLIST)` (covered by the loading bar); `Sound.playMusic(PLAYLIST, vol)` in `create()` consumes that stashed first track (`takeFirstTrack`) then streams the rest. So first-track latency is already solved.
- `BootScene` no longer loads game audio (only `title`). **Do not add `this.load.audio(...)` to BootScene** — register in `AUDIO_FILES` instead.
- Tests run in the **node** Vitest env. `sound.ts` and `assets.ts` both import Phaser, so **tests must import only the Phaser-free `musicKeys.ts`**, never `sound.ts`/`assets.ts`.

## Global Constraints

- Every game **with** background music has **exactly 3 tracks**, each a **unique recording** (no two games share a track). Soundboard has **no** music — out of scope.
- **No track is deleted.** Surplus tracks are respaced by renaming their mp3 files **and** their `AUDIO_FILES` keys; only Aquarium downloads net-new tracks.
- An audio **key === its `AUDIO_FILES` entry === the mp3 filename stem** (e.g. key `"garden1"` ↔ `AUDIO_FILES.garden1` ↔ `public/audio/garden1.mp3`).
- All music is **Kevin MacLeod / incompetech, CC-BY 4.0**, documented in `public/audio/CREDITS.md`.
- Build scripts are self-contained, one per game, each with its own `download()` helper (matches the 6 existing `build-*-audio.mjs` scripts — house style, not a defect).
- Commit per task using **explicit `git add <paths>`**. Do **not** stage unrelated working-tree changes from the refactor session.

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

| Old file | New file | Track | AUDIO_FILES key change |
|---|---|---|---|
| `music4.mp3` | `garden1.mp3` | Fluffing a Duck | `music4` → `garden1` |
| `music5.mp3` | `garden2.mp3` | Happy Bee | `music5` → `garden2` |
| `music6.mp3` | `garden3.mp3` | Wholesome | `music6` → `garden3` |
| `catch4.mp3` | `popmusic3.mp3` | Beach Party | `catch4` → `popmusic3` |
| `catch5.mp3` | `gumball3.mp3` | Bumbly March | `catch5` → `gumball3` |

### New downloads (3, verified HTTP 200 on 2026-06-27)

Base: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/<Title>.mp3`

| File | Title |
|---|---|
| `aquarium.mp3` (repoint, overwrites Carefree) | Deep Haze |
| `aquarium2.mp3` | Lightless Dawn |
| `aquarium3.mp3` | Anamalie |

Verified-200 fallbacks if any URL 404s: Pamgaea, Lobby Time, Sweeter Vermouth, Sunday Dub.

---

## File Structure

- **Create** `src/audio/musicKeys.ts` — pure per-game key arrays + `GAME_MUSIC` registry. No Phaser import.
- **Create** `src/audio/musicKeys.test.ts` — invariant test (3 keys/game; unique within + across games).
- **Create** `src/audio/musicAssets.test.ts` — asset guard (every key → non-empty mp3; no two byte-identical).
- **Modify** `src/audio/sound.ts` — import `MUSIC_KEYS` from `musicKeys`, re-export the other playlists, drop the inline key definitions. Keep the `ensureAudioLoaded`/`takeFirstTrack` import and the whole `Sound` class.
- **Modify** `src/render/assets.ts` — `AUDIO_FILES`: rename 5 keys, add `aquarium2`/`aquarium3`.
- **Modify** `src/scenes/AquariumScene.ts` — convert single-loop to `AQUARIUM_MUSIC_KEYS` playlist (`preloadFirstTrack` + `playMusic`).
- **Modify** build scripts: `build-pop-audio.mjs`, `build-gumball-audio.mjs`, `build-aquarium-audio.mjs`, `build-garden-audio.mjs`, comment in `build-audio.mjs`.
- **Rename** 5 mp3s + **download** 3 mp3s in `public/audio/`; **update** `public/audio/CREDITS.md`.
- **Not touched:** `BootScene.ts` (no game audio there now); `GardenScene`/`PopScene`/`GumballScene`/`GameScene`/`CatchScene` (they reference the `*_MUSIC_KEYS` constants, which change in place).

---

## Task 1: Music-key registry module + invariant test

**Files:**
- Create: `src/audio/musicKeys.ts`
- Test: `src/audio/musicKeys.test.ts`
- Modify: `src/audio/sound.ts` (the key-definition block at the top, ~lines 1-13)
- Modify: `scripts/build-audio.mjs` (stale `music1-4` comment → `music1-3`, 2 spots)

**Interfaces:**
- Produces: `MUSIC_KEYS`, `CATCH_MUSIC_KEYS`, `POP_MUSIC_KEYS`, `GUMBALL_MUSIC_KEYS`, `PEEKABOO_MUSIC_KEYS`, `GARDEN_MUSIC_KEYS`, `EGGS_MUSIC_KEYS`, `AQUARIUM_MUSIC_KEYS` (each `readonly string[]`, length 3) and `GAME_MUSIC: Record<string, readonly string[]>` from `src/audio/musicKeys.ts`. `sound.ts` re-exports every `*_MUSIC_KEYS` name so scene imports keep working.

- [ ] **Step 1: Write the failing test** — create `src/audio/musicKeys.test.ts`:
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
Expected: FAIL — cannot resolve `./musicKeys`.

- [ ] **Step 3: Create the registry module** — create `src/audio/musicKeys.ts`:
```ts
// Pure music-track key registry — no Phaser import, so the per-game invariant
// (exactly 3 unique tracks each) is unit-testable in the node test env. Each key
// equals its AUDIO_FILES entry (src/render/assets.ts) and the mp3 filename stem
// in public/audio (e.g. "garden1" -> public/audio/garden1.mp3).

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

In `src/audio/sound.ts`, the top currently is:
```ts
import Phaser from "phaser";
import { ensureAudioLoaded, takeFirstTrack } from "../render/assets";

export const MUSIC_KEYS = ["music1", "music2", "music3", "music4", "music5", "music6"] as const;
export const CATCH_MUSIC_KEYS: readonly string[] = ["catch1", "catch2", "catch3", "catch4", "catch5"];
export const POP_MUSIC_KEYS: readonly string[] = ["popmusic", "popmusic2"];
export const GUMBALL_MUSIC_KEYS: readonly string[] = ["gumball", "gumball2"];
export const PEEKABOO_MUSIC_KEYS: readonly string[] = ["peekaboo1", "peekaboo2", "peekaboo3"];
// Garden reuses the calm meadow tracks as a quiet ambient bed (the tap-notes are the foreground).
export const GARDEN_MUSIC_KEYS: readonly string[] = PEEKABOO_MUSIC_KEYS;
export const GARDEN_NOTE_COUNT = 11;
export const EGGS_MUSIC_KEYS: readonly string[] = ["eggsmusic", "eggsmusic2", "eggsmusic3"];
const GIGGLE_KEYS = ["giggle1", "giggle2", "giggle3"] as const;
```
Replace everything from the `export const MUSIC_KEYS …` line through the `EGGS_MUSIC_KEYS` line (i.e. all the per-game key definitions) with:
```ts
import { MUSIC_KEYS } from "./musicKeys";

// Per-game playlists live in the Phaser-free musicKeys module; re-export them so
// scenes can keep importing the names from here.
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
Keep the existing `import Phaser from "phaser";` and `import { ensureAudioLoaded, takeFirstTrack } from "../render/assets";` lines above, the `const GIGGLE_KEYS = …` line below, and the entire `Sound` class unchanged. (`MUSIC_KEYS` is still the default `_playlist` / `playMusic` default — now sourced from the import.)

- [ ] **Step 6: Fix the stale comment in `build-audio.mjs`**

In `scripts/build-audio.mjs`, change both occurrences of `music1-4` to `music1-3` (the header comment ~line 7 and the NOTE ~line 215).

- [ ] **Step 7: Verify**

Run: `npm test` → PASS (existing + 3 new).
Run: `npx tsc --noEmit` → no errors (scene imports of `*_MUSIC_KEYS` resolve via re-exports).

- [ ] **Step 8: Commit**
```bash
git add src/audio/musicKeys.ts src/audio/musicKeys.test.ts src/audio/sound.ts scripts/build-audio.mjs
git commit -m "refactor(audio): extract per-game music keys + invariant test"
```

---

## Task 2: Respace Galaga surplus into Garden

**Files:**
- Rename: `public/audio/music4.mp3`→`garden1.mp3`, `music5.mp3`→`garden2.mp3`, `music6.mp3`→`garden3.mp3`
- Modify: `src/render/assets.ts` (`AUDIO_FILES`: `music4/5/6` → `garden1/2/3`)
- Modify: `scripts/build-garden-audio.mjs`
- Modify: `public/audio/CREDITS.md`

**Interfaces:**
- Consumes: `GARDEN_MUSIC_KEYS = ["garden1","garden2","garden3"]` (Task 1). `GardenScene` already calls `preloadFirstTrack(this, GARDEN_MUSIC_KEYS)` + `playMusic(GARDEN_MUSIC_KEYS, 0.3)` — no scene change.
- Produces: `public/audio/garden1.mp3`, `garden2.mp3`, `garden3.mp3`; `AUDIO_FILES` entries for those keys.

- [ ] **Step 1: Rename the three surplus mp3s**
```bash
git mv public/audio/music4.mp3 public/audio/garden1.mp3
git mv public/audio/music5.mp3 public/audio/garden2.mp3
git mv public/audio/music6.mp3 public/audio/garden3.mp3
```

- [ ] **Step 2: Update `AUDIO_FILES`**

In `src/render/assets.ts`, replace these three entries:
```ts
  music4: ["audio/music4.mp3"],
  music5: ["audio/music5.mp3"],
  music6: ["audio/music6.mp3"],
```
with:
```ts
  garden1: ["audio/garden1.mp3"],
  garden2: ["audio/garden2.mp3"],
  garden3: ["audio/garden3.mp3"],
```

- [ ] **Step 3: Add a reproducible music download to `build-garden-audio.mjs`**

Add `import https from "https";` right after the `import lamejs from "@breezystack/lamejs";` line. Then replace the final `main();` line with:
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
(The script already imports `fs`/`path` and defines `OUT_DIR`.)

- [ ] **Step 4: Update CREDITS.md** — change the `music4`/`music5`/`music6` rows' **File** column to `garden1.mp3`/`garden2.mp3`/`garden3.mp3` (titles Fluffing a Duck / Happy Bee / Wholesome; URLs unchanged).

- [ ] **Step 5: Verify**

Run: `npm test` → PASS.  Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 6: Commit**
```bash
git add public/audio/garden1.mp3 public/audio/garden2.mp3 public/audio/garden3.mp3 \
        src/render/assets.ts scripts/build-garden-audio.mjs public/audio/CREDITS.md
git commit -m "feat(garden): respace shooter surplus into Garden's own 3 tracks"
```

---

## Task 3: Respace Catch surplus into Pop and Gumball

**Files:**
- Rename: `public/audio/catch4.mp3`→`popmusic3.mp3`, `catch5.mp3`→`gumball3.mp3`
- Modify: `src/render/assets.ts` (`AUDIO_FILES`: `catch4`→`popmusic3`, `catch5`→`gumball3`)
- Modify: `scripts/build-pop-audio.mjs` (full rewrite), `scripts/build-gumball-audio.mjs` (full rewrite)
- Modify: `public/audio/CREDITS.md`

**Interfaces:**
- Consumes: `POP_MUSIC_KEYS = ["popmusic","popmusic2","popmusic3"]`, `GUMBALL_MUSIC_KEYS = ["gumball","gumball2","gumball3"]` (Task 1). `PopScene`/`GumballScene` already pass these to `preloadFirstTrack`/`playMusic` — no scene change.
- Produces: `public/audio/popmusic3.mp3`, `gumball3.mp3`; `AUDIO_FILES` entries.

- [ ] **Step 1: Rename the two surplus mp3s**
```bash
git mv public/audio/catch4.mp3 public/audio/popmusic3.mp3
git mv public/audio/catch5.mp3 public/audio/gumball3.mp3
```

- [ ] **Step 2: Update `AUDIO_FILES`**

In `src/render/assets.ts`, replace:
```ts
  catch4: ["audio/catch4.mp3"],
  catch5: ["audio/catch5.mp3"],
```
with:
```ts
  popmusic3: ["audio/popmusic3.mp3"],
  gumball3: ["audio/gumball3.mp3"],
```
(Place near the other pop/gumball entries if you prefer; position is irrelevant.)

- [ ] **Step 3: Widen `build-pop-audio.mjs`** — replace the entire file with:
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

- [ ] **Step 4: Widen `build-gumball-audio.mjs`** — replace the entire file with the same structure, using these TRACKS:
```js
const TRACKS = [
  { file: "gumball.mp3",  title: "The Builder",      url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Builder.mp3" },
  { file: "gumball2.mp3", title: "Itty Bitty 8 Bit", url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Itty%20Bitty%208%20Bit.mp3" },
  { file: "gumball3.mp3", title: "Bumbly March",     url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bumbly%20March.mp3" },
];
```
(Header doc → "Unicorn Gumballs' 3-track playlist", outputs `gumball.mp3, gumball2.mp3, gumball3.mp3`, failure hint "another bouncy CC-BY track". Everything else identical to the pop script.)

- [ ] **Step 5: Update CREDITS.md** — change the `catch4.mp3` row's **File** to `popmusic3.mp3` (Beach Party) and the `catch5.mp3` row's **File** to `gumball3.mp3` (Bumbly March). URLs unchanged.

- [ ] **Step 6: Verify**

Run: `npm test` → PASS.  Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 7: Commit**
```bash
git add public/audio/popmusic3.mp3 public/audio/gumball3.mp3 src/render/assets.ts \
        scripts/build-pop-audio.mjs scripts/build-gumball-audio.mjs public/audio/CREDITS.md
git commit -m "feat(pop,gumball): respace Catch surplus into a 3rd track each"
```

---

## Task 4: Aquarium — 3 fresh ambient tracks + playlist conversion

**Files:**
- Modify: `scripts/build-aquarium-audio.mjs` (full rewrite)
- Download: `public/audio/aquarium.mp3` (overwrite), `aquarium2.mp3`, `aquarium3.mp3`
- Modify: `src/render/assets.ts` (`AUDIO_FILES`: add `aquarium2`, `aquarium3`)
- Modify: `src/scenes/AquariumScene.ts` (imports; `preload()`; the music block in `create()`)
- Modify: `public/audio/CREDITS.md`

**Interfaces:**
- Consumes: `AQUARIUM_MUSIC_KEYS = ["aquarium","aquarium2","aquarium3"]` (Task 1); `preloadFirstTrack`, `loadAudio` (assets.ts); `Sound.playMusic(playlist, volume)`.
- Produces: `public/audio/aquarium.mp3` (Deep Haze), `aquarium2.mp3` (Lightless Dawn), `aquarium3.mp3` (Anamalie); `AUDIO_FILES.aquarium2`/`aquarium3`.

**Network note:** Step 2 needs outbound HTTPS to incompetech.com (URLs verified 200 on 2026-06-27). On a 404 the script prints `FAILED`; substitute a verified-200 fallback (Pamgaea, Lobby Time, Sweeter Vermouth, Sunday Dub) in the script and CREDITS.

- [ ] **Step 1: Rewrite `build-aquarium-audio.mjs`** — replace the entire file with the pop-script structure, using these TRACKS and calm wording:
```js
const TRACKS = [
  { file: "aquarium.mp3",  title: "Deep Haze",      url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Deep%20Haze.mp3" },
  { file: "aquarium2.mp3", title: "Lightless Dawn", url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lightless%20Dawn.mp3" },
  { file: "aquarium3.mp3", title: "Anamalie",       url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Anamalie.mp3" },
];
```
(Header → "Tap the Aquarium's 3-track playlist (calm/ambient)", outputs `aquarium.mp3, aquarium2.mp3, aquarium3.mp3`, failure hint "another calm CC-BY track".)

- [ ] **Step 2: Download the 3 tracks**

Run: `npm run aquarium-audio`
Expected: three `... ok` lines; `aquarium.mp3` overwritten, `aquarium2.mp3`/`aquarium3.mp3` created. Confirm non-empty: `ls -l public/audio/aquarium*.mp3`.

- [ ] **Step 3: Update `AUDIO_FILES`** — in `src/render/assets.ts`, after the `aquarium: ["audio/aquarium.mp3"],` entry add:
```ts
  aquarium2: ["audio/aquarium2.mp3"],
  aquarium3: ["audio/aquarium3.mp3"],
```

- [ ] **Step 4: Update AquariumScene imports**

In `src/scenes/AquariumScene.ts`:
- Add `AQUARIUM_MUSIC_KEYS` to the `../audio/sound` import (it already imports `Sound`).
- In the `../render/assets` import, replace `ensureAudioLoaded` with `preloadFirstTrack` (ensureAudioLoaded is no longer used after this task; keep `loadAudio`, `loadAtlas`, `loadEmoji`, `registerEmojiAnims`, `showLoadingBar`).

- [ ] **Step 5: Preload the first track**

In `preload()`, change:
```ts
    loadAudio(this, ["aquarium", "blub", "sproing", "chime", "fanfare", "tada"]);
```
to:
```ts
    loadAudio(this, ["blub", "sproing", "chime", "fanfare", "tada"]);
    preloadFirstTrack(this, AQUARIUM_MUSIC_KEYS);
```

- [ ] **Step 6: Convert the single-loop to the shared playlist**

In `create()`, replace the music block:
```ts
    // Dedicated looping music (quieter so SFX stay crisp), streamed on first
    // entry so it isn't part of the initial download. Robust autoplay (immediate
    // + delayed retry + unlock/first-tap); `left` guards every deferred path so a
    // late track-load or retry can't resurrect music after we've left the scene.
    let music: Phaser.Sound.BaseSound | undefined;
    let left = false;
    const startMusic = () => { if (!left && music && !music.isPlaying) music.play(); };
    ensureAudioLoaded(this, "aquarium", () => {
      if (left) return;
      music = this.sound.add("aquarium", { loop: true, volume: 0.38 });
      startMusic();
      this.time.delayedCall(200, startMusic);
      if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
      this.input.once("pointerdown", startMusic);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      left = true;
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.sound.off(Phaser.Sound.Events.UNLOCKED, startMusic);
      music?.stop();
      this.sound.stopAll();
```
with:
```ts
    // 3-track ambient playlist (quieter so SFX stay crisp). First track is
    // preloaded (preloadFirstTrack) so it starts the instant the scene shows; the
    // rest stream on demand. Sound guards its own SHUTDOWN so a late track-load
    // can't resurrect music after we leave.
    this.sound2.playMusic(AQUARIUM_MUSIC_KEYS, 0.38);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.sound.stopAll();
```
Leave the rest of the SHUTDOWN handler (the `do NOT iterate this.fish` comment block and closing) exactly as-is. `this.sound.stopAll()` stops the current playlist track; `Sound`'s own SHUTDOWN listener sets `_stopped`, so the streamed-track callback won't start on a dead scene.

- [ ] **Step 7: Update CREDITS.md** — retitle the `aquarium.mp3` row Carefree → **Deep Haze** (`.../Deep%20Haze.mp3`); add `aquarium2.mp3` **Lightless Dawn** and `aquarium3.mp3` **Anamalie**, all CC-BY 4.0.

- [ ] **Step 8: Verify**

Run: `npm test` → PASS.  Run: `npx tsc --noEmit` → no errors (confirm `ensureAudioLoaded` is no longer referenced in AquariumScene; remove the import if it is unused).

- [ ] **Step 9: Commit**
```bash
git add scripts/build-aquarium-audio.mjs public/audio/aquarium.mp3 public/audio/aquarium2.mp3 \
        public/audio/aquarium3.mp3 src/render/assets.ts src/scenes/AquariumScene.ts public/audio/CREDITS.md
git commit -m "feat(aquarium): 3 unique ambient tracks via the shared playlist"
```

---

## Task 5: Asset guard test + full verification

**Files:**
- Test: `src/audio/musicAssets.test.ts`

**Interfaces:**
- Consumes: `GAME_MUSIC` (Task 1) and the renamed/downloaded mp3s in `public/audio/` (Tasks 2-4).

- [ ] **Step 1: Write the asset guard test** — create `src/audio/musicAssets.test.ts`:
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
Expected: PASS (24 files present, all distinct). A failure on `aquarium`/`music2` means the Carefree dup wasn't swapped — re-run Task 4 Step 2.

- [ ] **Step 3: Verify every music key is registered in AUDIO_FILES** (guards the silent no-load bug)

Run (bash):
```bash
for k in music1 music2 music3 catch1 catch2 catch3 popmusic popmusic2 popmusic3 \
         gumball gumball2 gumball3 peekaboo1 peekaboo2 peekaboo3 garden1 garden2 garden3 \
         eggsmusic eggsmusic2 eggsmusic3 aquarium aquarium2 aquarium3; do
  grep -q "^\s*$k:" src/render/assets.ts || echo "MISSING from AUDIO_FILES: $k"
done; echo "done"
```
Expected: only `done` (no MISSING lines).

- [ ] **Step 4: Full suite + production build**

Run: `npm test` → PASS.  Run: `npm run build` → `tsc --noEmit` clean, `vite build` succeeds.

- [ ] **Step 5: Manual smoke (recommended)**

`npm run dev`; visit each game. Confirm Aquarium music advances past its first track over time and Garden's bed differs from Peekaboo. Stop the server when done.

- [ ] **Step 6: Commit**
```bash
git add src/audio/musicAssets.test.ts
git commit -m "test(audio): guard 3-unique-tracks-per-game at the asset level"
```

---

## Self-Review

- **Spec coverage:** Galaga/Catch trim → keys (Task 1); Garden own tracks → Task 2; Pop/Gumball 3rd track → Task 3; Aquarium 3 unique + playlist + Carefree swap → Task 4; Soundboard untouched (intentional); "no deletion" → all moves are `git mv`; per-game uniqueness → Tasks 1 (keys) + 5 (recordings). New-model coverage: registration in `AUDIO_FILES` (Tasks 2-4, verified Task 5 Step 3); first-track latency handled by existing `preloadFirstTrack`. ✓
- **Placeholder scan:** No TBD/TODO; full content in every code step. ✓
- **Type consistency:** `*_MUSIC_KEYS` defined in `musicKeys.ts` (Task 1), re-exported by `sound.ts` (Task 1), imported by `AquariumScene` (Task 4); `GAME_MUSIC` used in both test files; `playMusic(playlist, volume)`, `preloadFirstTrack(scene, playlist)`, `loadAudio(scene, keys)` match the live signatures in `sound.ts`/`assets.ts`. ✓
