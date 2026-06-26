# Pop the Cuties — Design Spec

**Date:** 2026-06-26
**Status:** Approved design, ready for implementation planning
**Research brief:** [docs/superpowers/research/2026-06-26-pop-the-cuties-brief.md](../research/2026-06-26-pop-the-cuties-brief.md)
**Project:** *Zoe's Rainbow Unicorn* (Phaser 4 + TypeScript + Vite), a no-fail browser/PWA game for a
4-year-old. This adds a **third game mode** alongside Rainbow Shoot (Galaga-style shooter) and Rainbow
Catch (falling-item catch).

---

## 1. Overview

**Pop the Cuties** is a standalone tap-to-pop mode reached from a new title-screen button. Cute animated
emoji **bubble-float gently upward** from the bottom of the screen with a soft side-to-side sway; the child
**taps/pokes them to pop** each into a particle sparkle burst with a pop sound. There is no unicorn and no
chasing — the finger is the only tool. It is fully no-fail and endless.

The one global float speed sits on a **self-balancing notch ladder** (reusing the existing `src/core/catch.ts`
model): each pop speeds it up, each cutie that escapes off the top un-popped slows it down — so it always
drifts toward the child's current skill and can never run away from her.

The mode has its own identity: a new shape-based **underwater background** (teal/aqua, ambient rising
bubbles, light rays — distinct from the meadow and space), a pooled **particle-burst** pop effect, generous
**multi-touch** popping, a rare **rainbow bonus** cutie that clears the screen, and its own **dedicated music
track**, while reusing the existing animated-emoji sprites, `Celebrations`, and `pop` SFX.

## 2. Goals & success criteria

The mode is "done" when:

1. A third title button **"🫧 Pop the Cuties"** launches a new `Pop` scene; a back button (⬅, top-right)
   returns to the title — same as Catch/Shoot.
2. Cute emoji rise from the bottom with a gentle bubble sway and varied speeds; tapping one **pops** it
   (particle burst + squash/stretch + pop sound) and increments a **pop count** shown top-left.
3. **Multi-touch:** each finger-down pops the **nearest cutie within a generous radius** (noticeably larger
   than the visible sprite); multiple fingers pop multiple cuties at once; popping never requires precision.
4. Float speed is **self-balancing** on the notch ladder: it rises after sustained popping, falls after
   sustained escapes, is clamped, and **resets on entry**. Speed changes are **stepped** and driven **only**
   by pops/escapes (no time creep).
5. **No-fail:** an escape only slows the game; no game-over, lives, or penalty. An escaping cutie gets a
   gentle float-away/wave acknowledgment, not a silent disappearance.
6. A **celebration fires every 20 pops** (big party burst + banner + happy sound), non-blocking.
7. A rare **rainbow bonus cutie** appears occasionally; popping it **clears every on-screen cutie** (each
   into its own burst, each counted) plus a big party.
8. The mode shows the **animated underwater background** and plays a **dedicated music track** with the
   existing SFX.
9. **Accessibility:** the celebration/bursts respect a **reduced-motion** path (honoring
   `prefers-reduced-motion`) — fewer particles, no screen shake.
10. The genuinely-logical pieces are a **pure module** with unit tests; the existing shooter and catch modes
    are untouched.

## 3. Non-goals (YAGNI)

- No unicorn, no chasing/movement of a player avatar, no shooting, enemies, formations, bosses, or levels.
- No score persistence / high scores (consistent with the rest of the game).
- No per-cutie-type rules beyond the single rainbow bonus: every ordinary cutie pops the same way and is
  worth +1.
- No physics engine — movement is the project's manual delta-time approach.
- No new texture atlas: reuse the existing animated-emoji spritesheets and the OpenMoji `sparkle` frame.
- No haptics in v1 (noted as a possible later enhancement; not load-bearing).

## 4. Architecture

Mirrors the project's split (pure logic in `src/core/`, rendering in `src/scenes/`):

- **Pure logic — reuse `src/core/catch.ts`** for the self-balancing float speed (no Phaser; already
  Vitest-tested). A pop is a `recordCatch`, an escape is a `recordMiss`; read speed via `speedForNotch`.
- **Pure logic — new `src/core/pop.ts`** (no Phaser, Vitest-tested) for the two genuinely-testable pieces
  unique to this mode: nearest-target selection and the bonus-spawn decision.
- **Scene — `src/scenes/PopScene.ts`** (standalone `Phaser.Scene`): owns the background, the rising-cutie
  pool, spawn timer, multi-touch input, pop/escape handling, the particle bursts, HUD, music, and
  celebrations. On each pop/escape it calls the pure modules and reads back the current speed.

### 4.1 Reused speed model — `src/core/catch.ts`

Reused **as-is** (no changes): `resetForEntry()` on scene entry; `recordCatch(state)` on each pop;
`recordMiss(state)` on each escape; `speedForNotch(state.notch)` for the current upward px/s. The existing
`SPEED_TABLE = [135,180,225,278,330,390,450,510]`, `START_NOTCH = 1`, `CATCHES_PER_STEP_UP = 5`,
`MISSES_PER_STEP_DOWN = 3` apply directly as **upward** float speeds. (Field names `catchCount`/`missCount`
read as pop/escape here; no rename — keeping the module shared and DRY.)

### 4.2 New pure module — `src/core/pop.ts`

No Phaser import. Two pure functions plus small constants:

```ts
export interface PointLike { x: number; y: number; }
export interface TargetLike { x: number; y: number; }

// Index of the nearest target within `radius` of (px,py), or -1 if none.
// Ties resolved by lowest index. Used by the multi-touch pop handler.
export function pickNearestWithinRadius(
  px: number, py: number, targets: readonly TargetLike[], radius: number
): number;

// Pure bonus-spawn decision. `rng` is an injected () => number in [0,1)
// (the scene passes Math.random; tests pass a stub). Enforces a minimum
// gap so the rainbow bonus is a periodic surprise, never back-to-back.
export const BONUS_MIN_GAP = 12;   // spawns since last bonus before eligible
export const BONUS_CHANCE = 0.08;  // per-eligible-spawn probability (~1 in 12.5)
export function shouldSpawnBonus(spawnsSinceBonus: number, rng: () => number): boolean;
```

`pickNearestWithinRadius` computes squared distance (no `sqrt` needed for comparison), returns the closest
index whose distance ≤ `radius`, else `-1`. `shouldSpawnBonus` returns `false` while
`spawnsSinceBonus < BONUS_MIN_GAP`, otherwise `rng() < BONUS_CHANCE`.

### 4.3 Scene — `src/scenes/PopScene.ts`

Responsibilities each frame and on events:

- **Multi-touch input:** in `create()`, `this.input.addPointer(3)` (→ 4 simultaneous touch pointers).
  Listen once on the **scene-level** `pointerdown` (not per-sprite `setInteractive`). On each event, build
  the list of active cuties `{x,y}` and call `pickNearestWithinRadius(pointer.x, pointer.y, list, CATCH_RADIUS)`;
  if a cutie is hit, pop it. Each finger fires its own event, so simultaneous taps pop simultaneously.
- **Rising cuties:** a pooled Phaser Group of animated-emoji sprites (via `spawnEmoji`/`resetEmoji`). Each
  frame, `y -= currentSpeed * dt` where `currentSpeed = speedForNotch(state.notch)`, and the horizontal sway
  is `x = baseX + Math.sin(t * swayFreq + swayPhase) * swayAmp` with per-cutie `swayFreq/swayPhase/swayAmp`
  and a small per-cutie speed jitter assigned at spawn. Items exiting the top (`y < -margin`) = an escape.
- **Spawning:** a fixed-interval accumulator (`spawnTimer += dt`; when `> SPAWN_INTERVAL`, spawn one and
  reset), capped at `MAX_CONCURRENT` on-screen cuties. Spawn at a random `x` within edge margins, just below
  the bottom. On each spawn increment `spawnsSinceBonus`; if `shouldSpawnBonus(...)` returns true, spawn a
  **rainbow bonus** cutie instead and reset `spawnsSinceBonus = 0`.
- **Pop (ordinary cutie):** `state = recordCatch(state)`; `popCount++`; play the pop FX (§5.3); recycle the
  sprite. Fire the milestone celebration when `popCount % CELEBRATION_EVERY === 0`.
- **Pop (rainbow bonus):** the bonus itself counts as a pop (`recordCatch` + `popCount++`), then clear
  **all** active ordinary cuties — each plays a burst and likewise counts as a pop — then run a single
  milestone check, `Celebrations.bigParty()` + `banner("🌈")` + a bonus sound, plus a brief camera shake
  (skipped under reduced motion).
- **Escape:** `state = recordMiss(state)`; the cutie plays a brief float-away/wave (small scale bob + fade)
  then recycles. No other consequence; escapes are **not** counted as pops.
- **Entry:** `state = resetForEntry()`; `popCount = 0`; `spawnsSinceBonus = 0`.
- **HUD:** pop count top-left, same style as the shooter/catch score (digit).
- **Lifecycle:** call `this.tweens.killTweensOf(sprite)` before recycling any cutie; register external
  listeners and stop music on `this.events.once(SHUTDOWN, …)` to avoid restart leaks.

## 5. Visuals & feel

### 5.1 Background — underwater (`src/scenes/ui/UnderwaterBackground.ts`)

A new shape-based animated background (Graphics + shape GameObjects + tweens — no runtime-generated
textures, avoiding the Phaser-4 blank-texture gotcha), styled distinctly from `Background.ts` (rainbow sky),
`CatchBackground.ts` (meadow), and `SpaceBackground.ts` (starfield):

- A **teal → aqua vertical gradient** fill (layered rectangles or a graphics gradient).
- **Ambient bubbles:** many small translucent circles continuously rising and wrapping (purely decorative,
  visually separate from the poppable cuties — smaller, fainter, non-interactive).
- **Soft light rays:** a few large, low-opacity diagonal shapes that drift/shimmer gently.
- Motion kept calm and low-contrast so it never competes with the cuties the child is tracking (per the
  brief's clutter/working-memory findings).
- Constructor `(scene, width, height)`, with `update(dtSeconds, width)` and `resize(width, height)`, matching
  the existing background components' shape.

### 5.2 The cuties

Reuse the existing animated-emoji set (`src/render/emoji.ts` via `spawnEmoji`/`resetEmoji`) for cosmetic
variety. `POP_ITEM_TYPES` is a small constant list of the cute, non-disappearing types — e.g. `star`, `heart`,
`flower`, `butterfly`, `gem`, `balloon`, plus the garden set (`icecream`=tulip, `donut`=ladybug,
`cupcake`=clover, `lollipop`=cat). All ordinary cuties behave identically and are worth +1. Scaled like the
catch items (≈`setScale(1.1)`).

### 5.3 Pop juice (per pop)

- **Particle burst:** a pooled set of 2–3 reusable `this.add.particles(0, 0, ATLAS_KEY, { frame:
  frameFor("sparkle"), emitting: false, reserve: 20, … })` emitters; on a pop call `emitter.explode(~12,
  x, y)` at the cutie's position.
- **Squash/stretch:** a brief elastic scale tween on the cutie at the pop moment (e.g. quick scale-up then
  to 0 with a Back/elastic ease) before recycling.
- **Pop sound:** fire-and-forget `this.sound.play("pop", { detune: Phaser.Math.Between(-120, 120) })` so
  rapid pops overlap and each sounds slightly different. (`pop` is already loaded in Boot.)

### 5.4 Rainbow bonus cutie

No new asset: a visually distinct treatment of an existing emoji (e.g. `star` or `gem`) made larger, with a
**rainbow color-cycle tint tween** and a gentle pulse/glow so it reads as special. Spawned per §4.3. Popping
it triggers the screen-clear party (§4.3). It floats and is popped like any cutie (generous radius).

### 5.5 Celebrations (reuse `scenes/ui/Celebrations.ts`)

- **Every 20 pops:** `bigParty()` + `banner("🌈")` + a happy sound (`fanfare`/`tada`). Non-blocking (play
  continues).
- **Rainbow bonus:** `bigParty()` + `banner` + bonus sound + brief `cameras.main.shake` (skipped under
  reduced motion).

### 5.6 Reduced motion

On entry, check `window.matchMedia?.("(prefers-reduced-motion: reduce)").matches`. When set: reduce particle
counts (e.g. `explode(4)` instead of 12), skip all `cameras.main.shake`, and use a gentler celebration. The
core gameplay (rising + popping) is unchanged.

## 6. Tuning parameters (spec defaults — change freely in playtest)

| Parameter | Default | Notes |
|---|---|---|
| Speed (reused `SPEED_TABLE`) | `[135,180,225,278,330,390,450,510]` px/s | upward; 8 notches; reused from `catch.ts` |
| `START_NOTCH` (reused) | `1` (~180 px/s) | gentle start; reset on entry |
| `SPAWN_INTERVAL` | `900 ms` | fixed; independent of speed |
| `MAX_CONCURRENT` | `12` | cap simultaneous cuties for readability |
| `CATCH_RADIUS` | `~90 px` | generous; ~1.5× the visible cutie |
| `CELEBRATION_EVERY` | `20` pops | milestone |
| `BONUS_MIN_GAP` | `12` spawns | min gap before another bonus is eligible |
| `BONUS_CHANCE` | `0.08` | per-eligible-spawn probability |
| `BURST_PARTICLES` | `12` (`4` reduced-motion) | per pop |
| sway freq / amp | small ranges | per-cutie randomized bubble wobble |
| `EDGE_MARGIN` | small | spawn/clamp inset from screen edges |

## 7. Audio

- **Dedicated music (new):** a single upbeat looping track for this mode, **sourced by the user** (their
  usual workflow). To keep the build runnable before the final file lands, add a small download script
  `scripts/build-pop-audio.mjs` (mirrors `build-catch-audio.mjs`) that fetches an upbeat royalty-free
  (Kevin MacLeod CC-BY) default to `public/audio/popmusic.mp3`, credited in `public/audio/CREDITS.md`;
  the user can swap the file. Loaded in Boot (key `popmusic`), played **looping at a slightly lower volume**
  so the pop SFX stay crisp, with the same robust autoplay/unlock wiring as the Title (immediate play + a
  short delayed retry + `UNLOCKED`/first-`pointerdown` retries), and **stopped on scene shutdown**.
- **SFX (reused):** `pop` (detuned per pop), and `fanfare`/`tada` for celebrations. The bonus sound reuses
  an existing happy SFX.

## 8. File structure

**Create:**
- `src/core/pop.ts` — pure `pickNearestWithinRadius` + `shouldSpawnBonus` (+ constants).
- `src/core/pop.test.ts` — Vitest unit tests for the pure module.
- `src/scenes/PopScene.ts` — the mode's scene.
- `src/scenes/ui/UnderwaterBackground.ts` — animated underwater background.
- `scripts/build-pop-audio.mjs` — download a default CC-BY track → `public/audio/popmusic.mp3`.
- Generated asset: `public/audio/popmusic.mp3` (user-swappable).

**Modify:**
- `src/main.ts` — register `PopScene` in the scene array; (multitouch via `addPointer` in the scene, so no
  config change required).
- `src/scenes/TitleScene.ts` — add the third button **"🫧 Pop the Cuties"** (pink `0xff5fa2`), at `y ≈ 1040`,
  → `this.scene.start("Pop")`.
- `src/scenes/BootScene.ts` — load `popmusic`.
- `public/audio/CREDITS.md` — credit the default track.
- `package.json` — add the `pop-audio` build script.
- `README.md` — note the new mode + `npm run pop-audio`.

## 9. Testing

- **Pure logic (`src/core/pop.test.ts`), Vitest:**
  - `pickNearestWithinRadius`: returns `-1` for an empty list; `-1` when all targets are outside the radius;
    the nearest index when several are inside; ties resolved by lowest index; exact-on-radius counts as a hit.
  - `shouldSpawnBonus`: always `false` while `spawnsSinceBonus < BONUS_MIN_GAP`; once eligible, `true` iff
    `rng() < BONUS_CHANCE` (verify with stub rng values just-below and just-above the threshold).
  - The reused `catch.ts` ladder is already covered by `src/core/catch.test.ts` (no new tests needed there).
- **Scene layer:** not unit-tested (consistent with the project). Verified by running the game in Claude
  Preview: cuties rise + sway and animate (never vanishing), tapping pops them with a burst + sound, multiple
  taps pop multiple, popping speeds the float up and letting cuties escape slows it down, the every-20
  celebration fires, the rainbow bonus clears the screen, the underwater background animates, music loops,
  and no console errors.

## 10. Open / deferred items

- Final music track selection (the user sources the dedicated track; the script provides a swappable default).
- Playtest tuning of the §6 table (speeds, spawn interval, catch radius, sway, bonus rate) on the real
  device, including the absolute pixel `CATCH_RADIUS` needed for a ~23 mm target on Zoe's phone.
- Possible later enhancements (not in v1): Android haptics (`navigator.vibrate`) on pop; an icon-based pop
  count for a pre-reader; a parent reduced-motion toggle in addition to the OS media query.
