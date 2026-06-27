# Design: 3 unique music tracks per game type

**Date:** 2026-06-27
**Status:** Approved

## Goal

Every game type that has background music should have **exactly 3 music tracks, each
unique to that game type**. No track is shared between two games. The Soundboard is a
tap-to-play instrument and intentionally has **no** background music — it is out of scope.

All tracks stay Kevin MacLeod / incompetech CC-BY 4.0, downloaded via the existing
per-game `build-*-audio.mjs` scripts, matching the project's established pattern.

## Current state (the problem)

| Game (scene) | Playlist today | Count | Issue |
|---|---|---|---|
| Galaga (`GameScene`) | `music1`–`music6` | 6 | too many |
| Catch (`CatchScene`) | `catch1`–`catch5` | 5 | too many |
| Pop (`PopScene`) | `popmusic`, `popmusic2` | 2 | too few |
| Gumball (`GumballScene`) | `gumball`, `gumball2` | 2 | too few |
| Peekaboo (`PeekabooScene`) | `peekaboo1`–`peekaboo3` | 3 | OK |
| Garden (`GardenScene`) | aliases `peekaboo1`–`3` | 0 own | not unique — reuses Peekaboo |
| Eggs (`EggsScene`) | `eggsmusic1`–`3` | 3 | OK |
| Aquarium (`AquariumScene`) | single `aquarium` loop | 1 | too few; also a dup of Galaga's "Carefree" |
| Soundboard (`SoundboardScene`) | none | 0 | out of scope (instrument) |

Two latent uniqueness bugs this also fixes: Garden's `GARDEN_MUSIC_KEYS` is literally
`= PEEKABOO_MUSIC_KEYS`, and `aquarium.mp3` is the same recording ("Carefree") as Galaga's
`music2.mp3`.

## Target state

Final playlists (★ = newly downloaded, ✂ = removed):

| Game | Keys | Tracks |
|---|---|---|
| Galaga | `music1–3` | Pixelland, Carefree, Monkeys Spinning Monkeys · ✂ Fluffing a Duck, Happy Bee, Wholesome |
| Catch | `catch1–3` | Sneaky Adventure, Cheery Monday, Pleasant Porridge · ✂ Beach Party, Bumbly March |
| Pop | `popmusic`, `popmusic2`, `popmusic3` | Wallpaper, Investigations, ★ Spazzmatica Polka |
| Gumball | `gumball`, `gumball2`, `gumball3` | The Builder, Itty Bitty 8 Bit, ★ 8bit Dungeon Level |
| Peekaboo | `peekaboo1–3` | Sneaky Snitch, Hyperfun, Quirky Dog (unchanged) |
| Garden | `garden1–3` ★ | ★ Easy Lemon, ★ Fig Leaf Times Two, ★ Daily Beetle |
| Eggs | `eggsmusic1–3` | Run Amok, The Curtain Rises, Barroom Ballet (unchanged) |
| Aquarium | `aquarium`, `aquarium2`, `aquarium3` ★ | ★ Deep Haze, ★ Lightless Dawn, ★ Anamalie |
| Soundboard | — | none (unchanged) |

`title.mp3` (Bit Quest) is the Title-screen theme, not a game playlist — untouched.

### New track URLs (all verified HTTP 200 on 2026-06-27)

Base: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/<Title>.mp3`

| File | Title |
|---|---|
| `popmusic3.mp3` | Spazzmatica Polka |
| `gumball3.mp3` | 8bit Dungeon Level |
| `garden1.mp3` | Easy Lemon |
| `garden2.mp3` | Fig Leaf Times Two |
| `garden3.mp3` | Daily Beetle |
| `aquarium.mp3` (repoint) | Deep Haze |
| `aquarium2.mp3` | Lightless Dawn |
| `aquarium3.mp3` | Anamalie |

Verified-200 fallbacks if any URL later 404s: Pamgaea, Lobby Time, Sweeter Vermouth, Sunday Dub.

## Changes

### `src/audio/sound.ts`
- `MUSIC_KEYS` → `["music1","music2","music3"]`.
- `CATCH_MUSIC_KEYS` → `["catch1","catch2","catch3"]`.
- `POP_MUSIC_KEYS` → add `"popmusic3"`.
- `GUMBALL_MUSIC_KEYS` → add `"gumball3"`.
- `GARDEN_MUSIC_KEYS` → `["garden1","garden2","garden3"]` (stop aliasing `PEEKABOO_MUSIC_KEYS`).
- Add `export const AQUARIUM_MUSIC_KEYS = ["aquarium","aquarium2","aquarium3"]`.

### `src/scenes/BootScene.ts`
- Remove loads: `music4`, `music5`, `music6`, `catch4`, `catch5`.
- Add loads: `popmusic3`, `gumball3`, `garden1`, `garden2`, `garden3`, `aquarium2`, `aquarium3`.

### `src/scenes/AquariumScene.ts`
Replace the hand-rolled single-loop (`this.sound.add("aquarium", { loop: true })` + manual
start retries) with the shared playlist:
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
natural end, not on stop, so the playlist does not chain after shutdown. The explicit
`music.stop()` line is removed.

### `src/scenes/GardenScene.ts`
No code change. It still calls `playMusic(GARDEN_MUSIC_KEYS, 0.3)`; the keys now resolve to
Garden's own three tracks instead of Peekaboo's. The per-tap pentatonic `Sound.note()` melody
is unchanged.

### Build scripts (`scripts/`)
- `build-pop-audio.mjs`: download the full 3-track set (`popmusic`, `popmusic2`, `popmusic3`).
- `build-gumball-audio.mjs`: download the full 3-track set (`gumball`, `gumball2`, `gumball3`).
- `build-aquarium-audio.mjs`: download the full 3-track set (`aquarium`=Deep Haze,
  `aquarium2`, `aquarium3`).
- `build-garden-audio.mjs`: keep the `gardennotes` sprite synthesis; add a 3-track music
  download (`garden1`–`garden3`).
- `build-audio.mjs` (Galaga, SFX-only): no functional change; optionally fix the stale
  "music1-4" comment to "music1-3".
- `build-catch-audio.mjs`: already downloads only `catch1–3` — no change.

### Assets
- Delete `public/audio/music4.mp3`, `music5.mp3`, `music6.mp3`, `catch4.mp3`, `catch5.mp3`.
- Run the four widened/extended scripts to fetch the 8 new mp3s into `public/audio/`.
- `public/audio/CREDITS.md`: remove the 5 deleted rows; add the 8 new rows.

## Verification

1. `npm run build` / typecheck passes (no dangling references to removed keys).
2. The 8 new mp3s exist in `public/audio/` and are non-empty.
3. App boots; each game scene plays only its own 3 tracks (spot-check Aquarium plays a
   playlist that advances, Garden's bed is distinct from Peekaboo).
4. No console errors about missing audio keys.

## Out of scope

- Soundboard background music (intentionally none).
- Any change to SFX, the Title theme, or the Garden tap-note melody.
- A shuffle/transition redesign of the playlist engine — current random-no-immediate-repeat
  behavior is kept.
