# Design: 3 unique music tracks per game type

**Date:** 2026-06-27
**Status:** Approved

## Goal

Every game type that has background music should have **exactly 3 music tracks, each
unique to that game type**. No track (recording) is shared between two games. The Soundboard
is a tap-to-play instrument and intentionally has **no** background music — out of scope.

**No tracks are deleted.** Games that have too many tracks have their surplus *respaced*
(moved) into games that are short. Only where there is genuinely nothing to move do we
download a fresh CC-BY track. All tracks stay Kevin MacLeod / incompetech CC-BY 4.0.

## Current state (the problem)

| Game (scene) | Playlist today | Count | Issue |
|---|---|---|---|
| Galaga (`GameScene`) | `music1`–`music6` | 6 | too many (3 surplus) |
| Catch (`CatchScene`) | `catch1`–`catch5` | 5 | too many (2 surplus) |
| Pop (`PopScene`) | `popmusic`, `popmusic2` | 2 | 1 short |
| Gumball (`GumballScene`) | `gumball`, `gumball2` | 2 | 1 short |
| Peekaboo (`PeekabooScene`) | `peekaboo1`–`peekaboo3` | 3 | OK |
| Garden (`GardenScene`) | aliases `peekaboo1`–`3` | 0 own | not unique — borrows Peekaboo |
| Eggs (`EggsScene`) | `eggsmusic1`–`3` | 3 | OK |
| Aquarium (`AquariumScene`) | single `aquarium` loop | 1 | 2 short; also a byte-identical dup of Galaga's `music2` ("Carefree") |
| Soundboard (`SoundboardScene`) | none | 0 | out of scope (instrument) |

5 surplus tracks (Galaga ×3, Catch ×2) and 7 empty slots → respace 5, download 2 + 1 for
Aquarium (the Carefree dup is swapped out, see below). The surplus tracks are upbeat/playful
and don't suit the calm Aquarium, so Aquarium gets fresh ambient downloads.

## Target state

★ = newly downloaded, → = respaced (file renamed, recording moved between games):

| Game | Keys | Tracks |
|---|---|---|
| Galaga | `music1–3` | Pixelland, Carefree, Monkeys Spinning Monkeys |
| Catch | `catch1–3` | Sneaky Adventure, Cheery Monday, Pleasant Porridge |
| Pop | `popmusic`, `popmusic2`, `popmusic3` | Wallpaper, Investigations, → Beach Party (from `catch4`) |
| Gumball | `gumball`, `gumball2`, `gumball3` | The Builder, Itty Bitty 8 Bit, → Bumbly March (from `catch5`) |
| Peekaboo | `peekaboo1–3` | Sneaky Snitch, Hyperfun, Quirky Dog (unchanged) |
| Garden | `garden1–3` | → Fluffing a Duck (`music4`), → Happy Bee (`music5`), → Wholesome (`music6`) |
| Eggs | `eggsmusic1–3` | Run Amok, The Curtain Rises, Barroom Ballet (unchanged) |
| Aquarium | `aquarium`, `aquarium2`, `aquarium3` | ★ Deep Haze, ★ Lightless Dawn, ★ Anamalie |
| Soundboard | — | none (unchanged) |

`title.mp3` (Bit Quest) is the Title-screen theme, not a game playlist — untouched.

### Respacing = rename, not delete

The 5 surplus files are **renamed** so keys stay meaningful; the recording moves games:

| Old file | New file | Track |
|---|---|---|
| `music4.mp3` | `garden1.mp3` | Fluffing a Duck |
| `music5.mp3` | `garden2.mp3` | Happy Bee |
| `music6.mp3` | `garden3.mp3` | Wholesome |
| `catch4.mp3` | `popmusic3.mp3` | Beach Party |
| `catch5.mp3` | `gumball3.mp3` | Bumbly March |

Nothing is removed from the project. "Carefree" still exists as Galaga's `music2`; only the
duplicate copy at `aquarium.mp3` is overwritten when Aquarium is repointed to Deep Haze, so
no unique recording is lost.

### New downloads (3, all verified HTTP 200 on 2026-06-27)

Base: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/<Title>.mp3`

| File | Title |
|---|---|
| `aquarium.mp3` (repoint) | Deep Haze |
| `aquarium2.mp3` | Lightless Dawn |
| `aquarium3.mp3` | Anamalie |

Verified-200 fallbacks if any URL later 404s: Pamgaea, Lobby Time, Sweeter Vermouth, Sunday Dub.

## Changes

### `src/audio/sound.ts`
- `MUSIC_KEYS` → `["music1","music2","music3"]`.
- `CATCH_MUSIC_KEYS` → `["catch1","catch2","catch3"]`.
- `POP_MUSIC_KEYS` → `["popmusic","popmusic2","popmusic3"]`.
- `GUMBALL_MUSIC_KEYS` → `["gumball","gumball2","gumball3"]`.
- `GARDEN_MUSIC_KEYS` → `["garden1","garden2","garden3"]` (stop aliasing `PEEKABOO_MUSIC_KEYS`).
- Add `export const AQUARIUM_MUSIC_KEYS = ["aquarium","aquarium2","aquarium3"]`.

### `src/scenes/BootScene.ts`
- Rename loads: `music4`→`garden1`, `music5`→`garden2`, `music6`→`garden3`,
  `catch4`→`popmusic3`, `catch5`→`gumball3`.
- Add loads: `aquarium2`, `aquarium3` (keep `aquarium`).

### `src/scenes/AquariumScene.ts`
Replace the hand-rolled single-loop (`this.sound.add("aquarium", { loop: true })` + manual
start retries + `music.stop()`) with the shared playlist:
```ts
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
```
The `musicStarted` guard preserves the original "robust autoplay" behavior (immediate +
delayed + unlock + first-tap) without starting the playlist twice. Shutdown already calls
`this.sound.stopAll()`, which stops the current track; Phaser fires `"complete"` only on
natural end (not on stop), so the playlist does not chain after shutdown.

### `src/scenes/GardenScene.ts`
No code change. It still calls `playMusic(GARDEN_MUSIC_KEYS, 0.3)`; the keys now resolve to
Garden's own three tracks instead of Peekaboo's. The per-tap pentatonic `Sound.note()` melody
is unchanged.

### Build scripts (`scripts/`)
Each game's build script reproduces its own 3 tracks. Respaced track URLs move to the
destination game's script.
- `build-pop-audio.mjs`: download `popmusic` (Wallpaper), `popmusic2` (Investigations),
  `popmusic3` (Beach Party).
- `build-gumball-audio.mjs`: download `gumball` (The Builder), `gumball2` (Itty Bitty 8 Bit),
  `gumball3` (Bumbly March).
- `build-garden-audio.mjs`: keep the `gardennotes` sprite synthesis; add a 3-track music
  download — `garden1` (Fluffing a Duck), `garden2` (Happy Bee), `garden3` (Wholesome).
- `build-aquarium-audio.mjs`: download `aquarium` (Deep Haze), `aquarium2` (Lightless Dawn),
  `aquarium3` (Anamalie).
- `build-audio.mjs` (Galaga, SFX-only): no functional change; fix the stale "music1-4"
  comment to "music1-3".
- `build-catch-audio.mjs`: already downloads only `catch1–3` — no change.

### Assets
- Rename the 5 surplus mp3s in `public/audio/` per the table above (git mv).
- Download the 3 new Aquarium mp3s (overwriting `aquarium.mp3`).
- `public/audio/CREDITS.md`: relabel the 5 moved rows to their new filenames; retitle the
  `aquarium.mp3` row (Carefree → Deep Haze); add rows for `aquarium2` (Lightless Dawn) and
  `aquarium3` (Anamalie). Net: nothing removed, +2 rows.

## Verification

1. `npm run build` / typecheck passes (no dangling references to old keys like `music4`/`catch4`).
2. `public/audio/` contains exactly the renamed files + the 3 new Aquarium mp3s, all non-empty.
3. App boots; each game plays only its own 3 tracks (spot-check: Aquarium advances through a
   3-track playlist; Garden's bed is distinct from Peekaboo).
4. No console errors about missing audio keys.

## Out of scope

- Soundboard background music (intentionally none).
- Any change to SFX, the Title theme, or the Garden tap-note melody.
- A shuffle/transition redesign of the playlist engine — current random-no-immediate-repeat
  behavior is kept.
