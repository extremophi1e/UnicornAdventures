# Rainbow Catch — Design Spec

**Date:** 2026-06-26
**Status:** Approved design, ready for implementation planning
**Research brief:** [docs/superpowers/research/2026-06-26-rainbow-catch-brief.md](../research/2026-06-26-rainbow-catch-brief.md)
**Project:** *Zoe's Rainbow Unicorn* (Phaser 4 + TypeScript + Vite), a no-fail browser/PWA game for a
4-year-old. This adds a **second game mode** alongside the existing Galaga-style shooter and endless
Rainbow mode.

---

## 1. Overview

**Rainbow Catch** is a second, standalone mode reached from a new title-screen button. Cute items fall
from the top of the screen; a free-roaming unicorn (mouse / touch / arrow keys) catches them by
overlapping. It is fully no-fail and endless. One global fall speed sits on a self-balancing notch ladder:
catching speeds it up, missing slows it down — so it always drifts toward the child's current skill and can
never run away from her.

The mode has its own visual and audio identity: a **parallax meadow** background (animated, distinct from
the shooter's gradient sky), a **new animated unicorn** (built from a user-supplied GIF, used only in this
mode), and a **separate music playlist** (same calm style, different tracks), while reusing the existing
sound effects, calm mode, and celebration helpers.

## 2. Goals & success criteria

The mode is "done" when:

1. A third title button **"🌈 Rainbow Catch"** launches a new `Catch` scene.
2. A unicorn moves freely (mouse / touch / arrow keys) and **catches falling items by generous overlap** —
   the catch hitbox is noticeably larger than the visible sprite, and catching never requires precision.
3. Fall speed is **self-balancing** on a notch ladder: it rises after sustained catching, falls after
   sustained missing, is clamped to `[min, max]` with `min` always catchable, and **resets on entry**.
   Speed changes are **stepped** (not per-event) and driven **only** by catches/misses (no time creep).
4. **No-fail:** a miss only slows the game; there is no game-over, no lives, no penalty screen.
5. A **catch count** shows top-left; a **celebration fires every 25 catches** (rainbow burst + happy
   sound), calm-mode aware.
6. The mode shows the **animated meadow background** and the **new animated unicorn**, and plays the
   **catch music playlist** with the **existing SFX**.
7. The **difficulty logic is a pure module** with unit tests; the existing shooter and Rainbow modes are
   untouched.

## 3. Non-goals (YAGNI)

- No shooting, enemies, formations, bosses, or levels.
- No score persistence / high scores (consistent with the rest of the game).
- No new difficulty settings UI beyond the existing calm toggle.
- No physics engine — movement uses the project's existing manual delta-time approach.
- No per-item-type rules: every item is caught the same way and worth the same.

## 4. Architecture

Two layers, mirroring the project's existing split (pure logic in `src/core/`, rendering in `src/scenes/`):

- **Pure logic — `src/core/catch.ts`** (no Phaser import, Vitest-tested): the difficulty/speed model.
- **Scene — `src/scenes/CatchScene.ts`** (standalone `Phaser.Scene`, not extending `GameScene`): owns the
  background, unicorn, falling-item pool, spawn timer, input, overlap detection, HUD, and celebrations. On
  each catch/miss it calls into the pure module and reads back the current fall speed.

Rationale (from the brief): the catch mode shares none of the shooter's mechanics, so a standalone scene is
cleaner than extending `GameScene` (the path `RainbowScene` takes). Keeping the speed model pure makes the
one piece of real logic testable headlessly.

### 4.1 Pure difficulty module — `src/core/catch.ts`

State:

```ts
interface CatchState {
  notch: number;        // index into the speed table
  catchCount: number;   // catches since the last notch change
  missCount: number;    // misses since the last notch change
}
```

Constants (spec defaults; **tunable** in playtest):

```ts
const SPEED_TABLE = [90, 120, 150, 185, 220, 260, 300, 340]; // px/s, index 0..7
const START_NOTCH = 1;          // ~120 px/s on entry
const CATCHES_PER_STEP_UP = 5;  // +1 notch every 5 catches
const MISSES_PER_STEP_DOWN = 3; // -1 notch every 3 misses
```

Pure functions (return new state; no side effects):

- `initialCatchState(): CatchState` → `{ notch: START_NOTCH, catchCount: 0, missCount: 0 }`.
- `recordCatch(s: CatchState): CatchState` — increments `catchCount`; if it reaches
  `CATCHES_PER_STEP_UP`, raise `notch` by 1 (clamped to `SPEED_TABLE.length - 1`) and **reset both
  counters to 0**; otherwise just the incremented `catchCount`.
- `recordMiss(s: CatchState): CatchState` — increments `missCount`; if it reaches `MISSES_PER_STEP_DOWN`,
  lower `notch` by 1 (clamped to `0`) and **reset both counters to 0**; otherwise just the incremented
  `missCount`.
- `speedForNotch(notch: number): number` → `SPEED_TABLE[clamp(notch, 0, len-1)]`.
- `resetForEntry(): CatchState` → same as `initialCatchState()` (called on scene entry).

Anti-thrash rules baked in (from the brief): only ±1 notch per change, hard clamp at both ends, reset both
counters on every change, down-step more sensitive than up-step (3 vs 5).

### 4.2 Scene — `src/scenes/CatchScene.ts`

Responsibilities each frame and on events:

- **Movement:** unicorn follows the pointer (mouse/touch) with light smoothing toward a target `{x,y}`;
  arrow keys move it directly. Position clamped to the play area with small edge margins. Free-roam in both
  axes (not locked to the bottom). Reuse the existing pointer-follow pattern from `GameScene`.
- **Falling items:** a pooled group of sprites using existing OpenMoji atlas frames. Each frame they move
  `y += currentSpeed * dt` where `currentSpeed = speedForNotch(state.notch)` (one global speed applied to
  all in-flight items — simplest, and steps are small enough not to feel jarring). Items spin gently for
  life (matching the shooter's collectibles).
- **Spawning:** a fixed-interval accumulator (`spawnTimer += dt`; when `> SPAWN_INTERVAL`, spawn one and
  reset). Spawn interval is **independent of speed** (only speed rides the ladder). Spawn at a random `x`
  within edge margins, just above the top. Cap concurrent on-screen items (see §6).
- **Catch detection:** distance/overlap check between the unicorn and each active item against a generous
  `CATCH_RADIUS` (larger than the visible unicorn). On catch: `fx.popAt`, `sound.collect()`,
  `state = recordCatch(state)`, increment score, kill+hide the item, and fire the milestone celebration
  when the score hits a multiple of 25.
- **Miss detection:** when an item passes the bottom (`y > height + margin`) uncaught:
  `state = recordMiss(state)`, kill+hide the item. No other consequence.
- **Entry:** `state = resetForEntry()`; score = 0.
- **HUD:** catch count top-left, same style as the shooter's score.

## 5. Visuals

### 5.1 Background — parallax meadow (`src/scenes/ui/CatchBackground.ts`)

A new, shape-based animated background (Graphics + shape GameObjects + tweens — no runtime-generated
textures, avoiding the Phaser-4 blank-texture gotcha). Distinct in *style* from `Background.ts`:

- Pale sky fill; a **sun** with slowly rotating rays (top-left).
- **Drifting clouds** crossing horizontally and wrapping.
- Layered **green hills** along the bottom.
- A **scrolling flower/ground strip** near the base (loops seamlessly) to convey gentle forward motion.
- **No balloon.**
- **Calm mode:** reduce or freeze motion (slow/stop cloud drift, ground scroll, and ray spin) for sensory
  comfort — consistent with the brief's no-spike guidance.

Motion is concentrated low and to the sides so it does not compete with the falling items the child is
tracking (per the brief's clutter/working-memory findings).

### 5.2 Unicorn — new animated sprite (catch mode only)

- Source art: the **animated GIF supplied by the user**. It is preserved in the session transcript and will
  be saved to `assets/source/catch-unicorn.gif` during implementation (extracted from the transcript, not
  re-pasted into chat).
- **Build step — `scripts/build-catch-unicorn.mjs`** (mirrors `scripts/build-atlas.mjs`, uses the existing
  `sharp` dev dependency): decode the GIF into frames (libvips handles frame disposal/transparency),
  composite them into a **horizontal sprite sheet PNG**, and emit a small JSON sidecar
  (`{ frameCount, frameWidth, frameHeight, delays }`). Wired as an `npm run` script (e.g.
  `"catch-unicorn"`).
- **Load & animate:** load the sheet in `BootScene` with a **distinct key** (e.g. `catchUnicorn`), register
  **one looping animation** globally in Boot (`this.anims.create({ frames: generateFrameNumbers(...),
  frameRate, repeat: -1 })`), and play it on the catcher sprite, scaled to fit the play area. The existing
  shooter unicorn (the `openmoji` atlas frame `"unicorn"`) is untouched — no key collision.
- Validate the actual GIF after a test extraction (uniform frame size, no ghost-pixel artifacts) before
  building the final sheet.

### 5.3 Falling items

Reuse existing OpenMoji cute frames for **cosmetic variety only** (e.g. gem, heart, cupcake, star,
lollipop, donut, ice cream, flower, butterfly). **Balloon is excluded** (per the user's preference). All
items behave identically and are each worth +1. Defined as a small constant list in the scene (or a tiny
`src/core` constant) — no atlas changes needed.

### 5.4 Celebrations

Reuse `scenes/ui/Celebrations.ts`:

- **Per catch:** `popAt(x, y)` sparkle burst at the catch point + `sound.collect()` (short, ~0.3–0.5 s).
- **Every 25 catches:** `bigParty()` + `banner("🌈")` and a happy sound (`fanfare`/`tada`). Already
  calm-aware (fewer particles, no screen shake in calm mode). No screen flash.

## 6. Tuning parameters (spec defaults — change freely in playtest)

| Parameter | Default | Notes |
|---|---|---|
| `SPEED_TABLE` | `[90,120,150,185,220,260,300,340]` px/s | 8 notches; `min`=90 always catchable |
| `START_NOTCH` | `1` (~120 px/s) | gentle start; reset on entry |
| `CATCHES_PER_STEP_UP` | `5` | +1 notch |
| `MISSES_PER_STEP_DOWN` | `3` | −1 notch (more sensitive than up) |
| `SPAWN_INTERVAL` | `1100 ms` | fixed; independent of speed |
| `MAX_CONCURRENT_ITEMS` | `4` | brief caps simultaneous items low (~3–4) |
| `CATCH_RADIUS` | `~90 px` | generous; larger than the visible unicorn |
| `CELEBRATION_EVERY` | `25` catches | milestone |
| `EDGE_MARGIN` | small | spawn/clamp inset from screen edges |
| `MOVE_SMOOTHING` | light lerp | pointer-follow feel; arrows move directly |

## 7. Audio

- **Catch playlist (new):** source **2–3 new royalty-free calm tracks** (same vein as the existing
  Kevin MacLeod tracks), add them as `catch1.mp3`…`catch3.mp3` (or similar), and credit them alongside the
  existing tracks. Extend `audio/sound.ts` so the catch scene plays this playlist (e.g. a playlist
  parameter on `playMusic`, or a `playCatchMusic()` method) using the same shuffle behavior.
- **SFX (reused):** `collect`, `pop`/sparkle, `fanfare`/`tada` — unchanged, already calm-aware.

## 8. Calm mode

Reuse `state/settings.ts` `settings.calm`. In catch mode: background motion reduced/frozen, celebration
softened (already handled by `Celebrations`), and music/SFX volumes lowered (already handled by `Sound`).
No screen flash anywhere.

## 9. File structure

**Create:**
- `src/core/catch.ts` — pure difficulty/speed model.
- `src/core/catch.test.ts` — Vitest unit tests for the model.
- `src/scenes/CatchScene.ts` — the mode's scene.
- `src/scenes/ui/CatchBackground.ts` — animated meadow background.
- `scripts/build-catch-unicorn.mjs` — GIF → sprite sheet (sharp).
- `assets/source/catch-unicorn.gif` — saved source art.
- Generated assets: `catch-unicorn` sheet PNG + JSON sidecar, `catch1..3.mp3` (output to wherever the
  existing atlas/audio build scripts write, e.g. `public/`).

**Modify:**
- `src/main.ts` — register `CatchScene` in the scene array.
- `src/scenes/TitleScene.ts` — add the third button **"🌈 Rainbow Catch"** (meadow-green, e.g. `0x7ed957`),
  positioned below the existing two (≈ `y = 1040`), → `this.scene.start("Catch")`.
- `src/scenes/BootScene.ts` — load the catch unicorn sheet + register its looping animation; load the catch
  music tracks (and any background assets if not procedural).
- `src/audio/sound.ts` — catch playlist support.
- `package.json` — add the `catch-unicorn` build script.

## 10. Testing

- **Pure logic (`src/core/catch.test.ts`), Vitest** — the only unit-tested layer:
  - `initialCatchState` / `resetForEntry` produce `notch = START_NOTCH`, zeroed counters.
  - 5 catches → notch +1 and counters reset; 4 catches → no change.
  - 3 misses → notch −1 and counters reset; 2 misses → no change.
  - Notch clamps at top of `SPEED_TABLE` (many catches never exceed max) and at `0` (many misses never go
    below min).
  - A notch change resets the *other* counter too (e.g. 4 catches then 3 misses still steps down cleanly).
  - `speedForNotch` returns the table value and clamps out-of-range indices.
- **Scene layer:** not unit-tested (consistent with the project). Verified by running the game; key visual
  checks: the meadow animates, the unicorn animation loops, catching/missing visibly speeds up/slows down,
  the every-25 celebration fires, and calm mode quiets motion/audio.

## 11. Open / deferred items

- Final GIF frame validation (uniform frame size, disposal artifacts) at build time.
- Music track selection (specific royalty-free tracks) — sourced during implementation; user can swap.
- Playtest tuning of the §6 table (speeds, spawn interval, catch radius, smoothing) on the real device.
- Desktop input emphasis (mouse vs arrows) for a 4-year-old — pointer-follow is primary; arrows are a
  bonus.
