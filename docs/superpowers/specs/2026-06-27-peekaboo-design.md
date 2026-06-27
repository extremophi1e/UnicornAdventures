# Peekaboo / Whack-a-Cutie — Design Spec

Date: 2026-06-27
Research brief: [docs/superpowers/research/2026-06-27-peekaboo-brief.md](../research/2026-06-27-peekaboo-brief.md)

**Goal:** A new no-fail "Peekaboo / Whack-a-Cutie" mode: cute emoji critters peek out
of hiding spots (burrows & flowers on the grass, clouds in the sky) and duck back
after a short window; tap one before it hides for a **giggle + sparkle + point**. The
"now you see me" surprise distinguishes it from Pop's floating-rise tapping. Reached
from a new title-screen button.

**Stack:** Phaser 4 + TypeScript + Vite (existing). Giggle SFX synthesized offline with
`@breezystack/lamejs` (existing dev dep). No new runtime dependencies, no new graphics.

## Global Constraints
- **No-fail, no game-over.** Catch = giggle + sparkle + point; an untapped critter just
  ducks back (no penalty) and only nudges difficulty down.
- **No separate calm mode** (consistent with the Animal Soundboard); keep the sparkle
  gentle and flashing-safe by construction (no rapid strobe, no camera shake).
- **No new graphics assets** — reuse the already-loaded emoji spritesheets for critters;
  hiding spots are drawn with Graphics. Only new runtime assets: 3 small giggle MP3s.
- **`src/core/` stays import-pure** (no Phaser/`render` imports), Vitest-tested. Rendering
  lives in the scene.
- TypeScript strict with `noUnusedLocals` + `noUnusedParameters`.
- On-screen emoji size rule: displayed px = `setScale × 144`.
- Multi-touch (two kids tap at once); register on **pointer-down**.

---

## 1. Pure logic — `src/core/peekaboo.ts` (Vitest-tested)

Difficulty reuses the existing `src/core/catch.ts` ladder (`CatchState`,
`initialCatchState`, `recordCatch`, `recordMiss`) — catching steps the notch up, a
miss steps it down (self-balancing, clamped, 8 notches). `peekaboo.ts` adds the
peekaboo-specific lookups, spot layout, and spawn selection. It may import `catch.ts`
(both are pure core) but nothing from `render`/Phaser.

```ts
export type SpotType = "burrow" | "flower" | "cloud";
export interface Spot { id: number; x: number; y: number; type: SpotType; }

// Fixed, responsive hiding-spot layout (deterministic — no rng — so spots are stable
// and testable). 7 spots: 2 cloud (upper sky), 3 burrow + 2 flower (lower meadow).
// Avoids the top HUD band (y < 150) and keeps clear of screen edges.
export function computeSpots(viewportW: number, viewportH: number): Spot[];

// Up-time (full-visible dwell, ms) per difficulty notch — non-increasing.
export const WINDOW_TABLE: readonly number[] = [2600, 2400, 2200, 2000, 1800, 1600, 1450, 1300];
// Max simultaneous critters per notch — non-decreasing, >= 1.
export const CONCURRENT_TABLE: readonly number[] = [1, 1, 1, 2, 2, 2, 3, 3];
export function windowForNotch(notch: number): number;     // clamps to table range
export function concurrentForNotch(notch: number): number; // clamps to table range

export const SURPRISE_CHANCE = 0.18; // fraction of pops that appear off-spot
export function shouldSurprise(rng: () => number): boolean; // rng() < SURPRISE_CHANCE

// Pick a random idle spot id to pop next, avoiding an immediate repeat of lastId.
// Returns -1 if none are idle. If lastId is the only idle spot, returns it.
export function chooseSpot(idleIds: readonly number[], lastId: number, rng: () => number): number;
```

`computeSpots` uses width/height fractions, e.g. clouds at `(0.26W, 320)` and
`(0.72W, 380)`; burrows at `(0.20W, 0.70H)`, `(0.50W, 0.82H)`, `(0.80W, 0.70H)`;
flowers at `(0.34W, 0.90H)`, `(0.66W, 0.90H)` (clamped so x∈[80, W-80], y∈[150, H-120]).

**Tests** (`tests/core/peekaboo.test.ts`):
- `computeSpots(600,1280)`: length 7; ids `0..6` unique; every spot within
  `x∈[80,520]`, `y∈[150,1160]`; the 2 `cloud` spots have smaller `y` than every
  `burrow`/`flower` spot; type counts = 2 cloud, 3 burrow, 2 flower.
- `windowForNotch`: non-increasing across `0..7`; `windowForNotch(-5)===WINDOW_TABLE[0]`;
  `windowForNotch(99)===WINDOW_TABLE[7]`.
- `concurrentForNotch`: non-decreasing; always `>=1`; clamps out-of-range.
- `chooseSpot([],3,rng)===-1`; `chooseSpot([2],2,rng)===2` (only idle is lastId);
  `chooseSpot([1,2,3],2,()=>0)` ∈ `[1,3]` (excludes lastId); result always a member
  of the input.
- `shouldSurprise(()=>SURPRISE_CHANCE-0.01)===true`; `shouldSurprise(()=>SURPRISE_CHANCE)===false`.

---

## 2. Scene — `src/scenes/PeekabooScene.ts` (key `"Peekaboo"`)

Registered in `src/main.ts` after `Soundboard`.

**Background.** A small static meadow+sky (new `src/scenes/ui/PeekabooBackground.ts`, or
inline Graphics): sky gradient + hills + ground band + a slow rotating sun. **Static
ground** (unlike `CatchBackground`'s scroll) so hiding spots stay put. Depth `-10`.

**Hiding-spot views.** For each `Spot` from `computeSpots`, draw a fixed visual:
- `burrow`: a dark-brown ellipse "hole", plus a **grass-rim arc occluder drawn on top**
  at `depth 20`; the critter sits at `depth 10` and tweens up from behind the rim.
- `flower`: a flower-clump Graphics as a **front occluder** (`depth 20`); critter peeks
  up behind it.
- `cloud`: a soft white cloud ellipse (`depth 10`); the critter **scale-pops** at the
  cloud (no occluder needed).

**Critter pool.** A `Phaser.GameObjects.Group` of emoji sprites (reused sheets). Cap a
few (≥ max concurrent + slack). Each pop picks a random cute critter key (from the
emoji set) and a spot/surprise position.

**Per-critter lifecycle** (driven by a `tweens.chain`, with the visible dwell =
`windowForNotch(state.notch)`):
1. **Tell**: brief spot wiggle (~250ms) so toddlers orient.
2. **Emerge**: ground → tween `y` up by ~`PEEK_DISTANCE` (≈ cell-relative, e.g. 96px),
   `Back.Out`, ~250ms; cloud → `scale` 0→target, `Back.Out`. Set `catchable=true`,
   `setInteractive`.
3. **Hold**: dwell `windowForNotch(notch)` ms.
4. **Duck**: ground → `y` back down `Power2.In` ~150ms; cloud → `scale`→0. A
   **coyote window** keeps `catchable=true` for ~100ms into the duck.
5. **Gone**: if not caught → `recordMiss`; `killAndHide`; mark spot idle after a min
   **re-pop cooldown** (~500ms).

**Tap (pointer-down on a critter).** Guard with `catchable && !caught`; on hit set
`caught=true` (no double-count), `killTweensOf(critter)`, snap, then: `Sound.giggle()`,
`Celebrations.popAt(x,y)`, a ~200ms squash/stretch tween, `score += 1`, `recordCatch`,
milestone check, quick "caught" vanish (pop up + fade), `killAndHide`, free the spot
(min cooldown). **No camera shake.**

**Scheduler.** A recurring `time.delayedCall` loop (~every `SPAWN_INTERVAL` 850ms,
re-armed each fire): if `activeCritters < concurrentForNotch(state.notch)`, decide
`shouldSurprise(rng)`; if surprise → pop at a random safe off-spot position (with a
small dust/sparkle puff, scale-pop, no occluder); else `chooseSpot(idleIds, lastId,
rng)` and pop there. Track `lastId` to avoid immediate repeats.

**Difficulty/state.** `this.state: CatchState = initialCatchState()` (reset in
`create`). `recordCatch` on a catch, `recordMiss` on an un-tapped duck.

**Multi-touch.** `this.input.addPointer(3)` (up to 4 simultaneous), like Pop. Each
critter `setInteractive` fires its own `pointerdown`.

**HUD.** Subtle top-left `⭐ <score>` text (same style as other modes). Milestone every
**15** catches → `Celebrations.bigParty()` + `Celebrations.banner("🌈")` +
`Sound.fanfare()`. Plain top-right `⬅` back → `scene.start("Title")`.

**Music.** Loop an existing already-loaded track at low volume — reuse the **Catch
meadow playlist** (`Sound.playMusic(CATCH_MUSIC_KEYS)`, thematically matching the
meadow); no new music asset. Stop on `SHUTDOWN`.

Constants (scene): `SPAWN_INTERVAL 850`, `PEEK_DISTANCE 96`, `COYOTE_MS 100`,
`SPOT_COOLDOWN_MS 500`, `MILESTONE_EVERY 15`, `CRITTER_SCALE 1.4/2`,
`SURPRISE` via `shouldSurprise`, giggle volume `0.6`.

---

## 3. Audio — giggle SFX

### `scripts/build-peekaboo-audio.mjs` (`npm run peekaboo-audio`)
Mirrors `scripts/build-audio.mjs` (same `SAMPLE_RATE 44100`, `CHANNELS 1`,
`encodeToMp3`, `sine`, envelope helpers). Synthesizes a **stylized chime "tee-hee"
giggle**: 3 rising sine/triangle blips, staggered ~70ms, each fast attack + ~120ms
exponential decay, bright (optional light high-pass), peak-normalized and kid-safe.
Produce **3 pitch variants** to avoid repeat-fatigue, e.g. base note sets transposed:
- `giggle1`: G5, B5, D6  (784, 988, 1175 Hz)
- `giggle2`: A5, C6, E6  (880, 1047, 1319 Hz)
- `giggle3`: F5, A5, C6  (698, 880, 1047 Hz)

Output `public/audio/giggle1.mp3`, `giggle2.mp3`, `giggle3.mp3` (each tiny). Add the
npm script `"peekaboo-audio": "node scripts/build-peekaboo-audio.mjs"`.

### `BootScene.preload()` — load the 3 variants
```ts
this.load.audio("giggle1", ["audio/giggle1.mp3"]);
this.load.audio("giggle2", ["audio/giggle2.mp3"]);
this.load.audio("giggle3", ["audio/giggle3.mp3"]);
```

### `Sound` — add `giggle()`
```ts
const GIGGLE_KEYS = ["giggle1", "giggle2", "giggle3"] as const;
// Play a random giggle variant (pitch variety avoids machine-gun fatigue).
giggle(volume = 0.6): void {
  const k = GIGGLE_KEYS[Math.floor(Math.random() * GIGGLE_KEYS.length)];
  this.scene.sound.play(k, { volume });
}
```

---

## 4. Title — 2×3 grid for 6 buttons
`src/scenes/TitleScene.ts`: replace the single-column stack with a **2×3 grid** of the
6 game buttons; keep the hero unicorn above (nudged up/smaller) and the title text.
Each grid button: rounded-rect, **emoji icon above** a wrapping centered label
(fontSize ~28, `wordWrap` to the button width) so long names ("Animal Soundboard",
"Unicorn Gumballs") fit.

- Button size: `w = (W - 2*MARGIN - GAP) / 2` (MARGIN 24, GAP 24), `h = 150`.
- Columns centered at `W/2 ± (w/2 + GAP/2)`; rows centered at `y = 600, 780, 960`.
- Hero unicorn `y≈300`, scale `~0.6`, bob target `~270`.
- Grid (row-major):
  | | left | right |
  |---|---|---|
  | row0 | 🌈 Rainbow Shoot → Game (0x9b6bff) | 🌈 Rainbow Catch → Catch (0x7ed957) |
  | row1 | 🫧 Pop the Cuties → Pop (0xff5fa2) | 🎁 Unicorn Gumballs → Gumball (0xff9f43) |
  | row2 | 🔊 Animal Soundboard → Soundboard (0x00b4d8) | 🐹 Peekaboo → Peekaboo (0xffd23f) |

Keep the existing `go(key)` audio-unlock gate and the title-music logic. Introduce a
`makeGridButton(x, y, w, h, emoji, label, color, onTap)` (replacing/adapting the old
`makeButton`).

---

## 5. File changes summary
- **Create** `src/core/peekaboo.ts` — pure spot layout + difficulty lookups + spawn selection.
- **Create** `tests/core/peekaboo.test.ts` — Vitest cases above.
- **Create** `src/scenes/PeekabooScene.ts` — the scene.
- **Create** `src/scenes/ui/PeekabooBackground.ts` — static meadow+sky (or inline in scene).
- **Create** `scripts/build-peekaboo-audio.mjs` — 3 giggle MP3 variants.
- **Modify** `src/scenes/BootScene.ts` — load giggle1/2/3.
- **Modify** `src/audio/sound.ts` — add `giggle()`.
- **Modify** `src/scenes/TitleScene.ts` — 2×3 grid + 6th button.
- **Modify** `src/main.ts` — register `PeekabooScene`.
- **Modify** `package.json` — `peekaboo-audio` script.
- **Generated (commit)** `public/audio/giggle1.mp3`, `giggle2.mp3`, `giggle3.mp3`.

## 6. Verification
- `npx tsc --noEmit`; `npm test` (existing 78 + new `peekaboo` tests); `npm run build`.
- `npm run peekaboo-audio` generates the 3 giggle MP3s (each small, non-empty).
- Preview: from the title (now a 2×3 grid) open Peekaboo; confirm critters peek from
  burrows/flowers/clouds + surprise pops, tapping one gives giggle + sparkle + score,
  untapped critters duck back, difficulty self-balances, multi-touch works, back returns.

## 7. Open items (resolved during implementation)
- Exact giggle timbre/levels need an ear pass (chime arpeggio is the target).
- Spot occluder art is Graphics-drawn; refine burrow/flower/cloud shapes for charm.
- Up-time/spawn constants are seeded from research; tune in the preview.
- Background-music track is a reuse (Catch playlist); swappable later.
