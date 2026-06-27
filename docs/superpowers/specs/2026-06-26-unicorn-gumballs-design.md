# Unicorn Gumballs (Surprise Machine) — Design Spec

**Date:** 2026-06-26
**Status:** Approved design, ready for implementation planning
**Research brief:** [docs/superpowers/research/2026-06-26-unicorn-gumballs-brief.md](../research/2026-06-26-unicorn-gumballs-brief.md)
**Project:** *Zoe and Desi's Rainbow Unicorn Adventures* (Phaser 4 + TypeScript + Vite), a no-fail
browser/PWA game for two young kids. This adds a **fourth game mode** alongside Rainbow Shoot,
Rainbow Catch, and Pop the Cuties.

---

## 1. Overview

**Unicorn Gumballs** is a standalone **surprise machine**. One giant button sits on a rainbow
gumball machine. Tap it → the machine **rattles** and its **bulbs flash** (a short anticipation
build-up) → a random cute thing **tumbles out of the chute** → **confetti + fanfare**. The button
is **locked during the ~1s reveal** (but keeps wiggling so it never looks frozen), then re-enables.
It is **pure sandbox** — no score, count, or collection — just the endless "what comes next?" loop
that young kids are wired to love. Rarely, a **unicorn jackpot** tumbles out with an extra-big party.

The mode has its own identity: a new shape-drawn **rainbow gumball machine** over a calm **cozy
playroom** background, and a **dedicated music track**, while reusing the animated-emoji cuties, the
`Celebrations` confetti/banner/sparkle helper, the `Sound` SFX, and the unified unicorn sprite.

## 2. Goals & success criteria

The mode is "done" when:

1. A fourth title button **"🎁 Unicorn Gumballs"** launches a new `Gumball` scene; a back button
   (⬅, top-right) returns to the title. The title's four buttons fit comfortably on screen.
2. Tapping the giant button plays the full sequence: **button squash + click → machine rattle +
   bulb flash (≤2 flashes/sec) → a cutie tumbles out (bouncy) → confetti + fanfare**.
3. The button is **locked while a pull is in progress** (taps ignored), yet stays visibly animated
   (wiggle) so a pre-reader never reads it as broken; it re-enables when the pull finishes.
4. The revealed item is a **random cutie with no immediate repeat**; **rarely** the **unicorn
   jackpot** appears instead, with an **extra-big party** (bigger confetti + banner + a distinct
   sting + a slow rainbow glow) — categorically different from an ordinary pull.
5. **Pure sandbox & no-fail:** no score/lives/penalty; nothing to lose; nothing saved.
6. The mode shows the **rainbow machine** over the **cozy-playroom background** and plays a
   **dedicated music track** with the existing SFX.
7. **Accessibility:** honors `prefers-reduced-motion` (replaces rattle/flash with a gentle
   glow-pulse; the reveal + confetti still play); flashes are seizure-safe (≤2/sec, no saturated
   red, small area); no text anywhere.
8. The genuinely-logical piece (the shuffle + jackpot) is a **pure module with unit tests**; the
   existing three modes are untouched.

## 3. Non-goals (YAGNI)

- No score, count, collection/"sticker book", or persistence.
- No purchase/coin/gacha-payment metaphor — it is free, endless, and wholesome by design.
- No per-item rules beyond the single jackpot; every ordinary cutie is equally likely (via the bag).
- No physics engine — the reveal is a tween, the rattle is a tween.
- No new texture atlas — reuse the animated-emoji sheets, the OpenMoji `sparkle` frame, and the
  `catchUnicorn` sheet.

## 4. Architecture

Mirrors the project's split (pure logic in `src/core/`, rendering in `src/scenes/`):

- **Pure logic — new `src/core/gumballs.ts`** (no Phaser, Vitest-tested): the shuffle-bag pick with
  no-immediate-repeat and the jackpot decision.
- **Scene — `src/scenes/GumballScene.ts`** (standalone `Phaser.Scene`): owns the playroom
  background, the machine graphic + bulbs + giant button, the reveal sequence, the pooled revealed
  item, and the Celebrations/Sound calls. It reads the pure module for each pull.

### 4.1 Pure module — `src/core/gumballs.ts`

No Phaser import. The "shuffle" the pitch refers to.

```ts
// The ordinary cuties (keys from src/render/emoji.ts).
export const GUMBALL_ITEMS = [
  "star", "heart", "flower", "butterfly", "gem", "balloon",
  "icecream", "donut", "cupcake", "lollipop", "cloud",
] as const;
export const JACKPOT = "unicorn";   // special: rendered from the catchUnicorn sheet, not the emoji set
export const JACKPOT_MIN_GAP = 8;   // ordinary pulls required before a jackpot is eligible
export const JACKPOT_CHANCE = 0.10; // per-eligible-pull probability → ~1 in 16 overall

export interface Bag { next(): string; }

// rng is an injected () => number in [0,1) (scene passes Math.random; tests stub it).
export function createBag(rng: () => number): Bag;
```

`createBag` keeps an internal Fisher–Yates **shuffle bag** of `GUMBALL_ITEMS` (refilled when empty)
and a `last` value so a refill seam can't repeat the previous item, plus a `sinceJackpot` counter.
`next()`:
1. If `sinceJackpot >= JACKPOT_MIN_GAP` and `rng() < JACKPOT_CHANCE` → reset `sinceJackpot = 0`,
   return `JACKPOT`.
2. Otherwise increment `sinceJackpot`, draw the next bag item (refill + de-seam against `last` if
   needed), set `last`, return it.

This guarantees: never the same ordinary cutie twice in a row, every cutie appears within two bag
cycles, and the jackpot is a periodic surprise (never back-to-back, ~1-in-16).

### 4.2 Scene — `src/scenes/GumballScene.ts`

State: `busy: boolean` (a pull is in progress), `bag` (from `createBag(Math.random)`),
`reduceMotion: boolean`.

Responsibilities:

- **Machine + button:** draw the rainbow machine (see §5.1). The giant button is an interactive
  rectangle with a **generous hit area**; `pointerdown` → `pull()`.
- **`pull()`:** if `busy`, return. Else `busy = true`; squash the button (0.92 → 1) + a click SFX;
  start the reveal sequence; keep the button **wiggling** until the pull completes.
- **Reveal sequence** (driven by `this.time.delayedCall` + concurrent tweens — **not** Phaser
  `Timeline`, which is removed in v4, nor `tweens.chain`, which has a top-level-`delay` bug):
  1. **Anticipation (~1–1.3s):** rattle the machine (yoyo tween on `x`/angle) **and** flash the
     bulbs at **≤2/sec** (a `this.time.addEvent` tint toggle using `TintModes.FILL`).
  2. **Reveal:** `const item = this.bag.next()`. Place the revealed sprite at the chute and tween it
     out — `Bounce.easeOut` on `y` (drop) + `Back.easeOut` on `scale` (0 → pop). Ordinary items use
     the pooled emoji sprite (`spawnEmoji`/`resetEmoji`); the **jackpot** uses the `catchUnicorn`
     sprite + its looping anim.
  3. **Payoff:** ordinary → `fx.popAt` + `fx.bigParty()` + `sound2.fanfare()`. Jackpot → a bigger
     party: `fx.bigParty()` + `fx.banner("🌈")` + `sound2.tada()` + a brief slow rainbow screen
     glow (skipped under reduced motion).
  4. Settle, then `busy = false`.
- **Reduced motion:** on entry, `reduceMotion = window.matchMedia?.("(prefers-reduced-motion:
  reduce)").matches`. When set: skip the rattle + bulb flash (use a single gentle glow-pulse
  instead), skip the screen glow/shake, and reduce the confetti count — but still reveal the item
  and play the fanfare.
- **HUD/back:** back button (⬅, top-right) → `this.scene.start("Title")`. No score text.
- **Lifecycle:** stop/kill all tweens and timed events and clear `busy` on
  `this.events.once(SHUTDOWN, …)`; stop the music there too. Pool of **1** for the revealed cutie.

## 5. Visuals & feel

### 5.1 The machine + background

- **`src/scenes/ui/PlayroomBackground.ts`** (shape-based; no runtime-generated textures): a soft
  cream→peach vertical gradient with subtle polka dots and a gentle drift. Calm, so the busy machine
  + flashes pop. Constructor `(scene, width, height)`, `update(dt, width)`, `resize(width, height)`
  — matching the other background components.
- **The machine** (drawn in the scene with Graphics + shapes): a **rainbow-striped domed cap**, a
  **clear glass globe** with a handful of small cuties gently **jumbling/bobbing** inside (idle
  ambient motion), a base, a **chute** at the lower edge, and a row/ring of **bulbs** that flash
  during anticipation. A **giant button** on the base.

### 5.2 Reveal juice

- **Button:** squash to ~0.92 on `pointerdown` then spring back; an immediate click SFX (reuse
  `pop`/`collect`). While `busy`, a small continuous wiggle so it reads as "working," not frozen.
- **Rattle:** yoyo tween on the machine container's `x`/angle (short, snappy).
- **Bulb flash:** tint toggle at ≤2/sec, no saturated red, small area (seizure-safe).
- **Tumble:** `Bounce.easeOut` drop + `Back.easeOut` scale pop from the chute.
- **Confetti/fanfare:** reuse `Celebrations.bigParty()` + `Sound.fanfare()`.

### 5.3 Jackpot

The **unicorn** (from the `catchUnicorn` sheet) tumbles out with an **extra-big party**: a larger
`bigParty`, `banner("🌈")`, `tada`, and a slow full-screen rainbow glow (a low-opacity overlay
tween, ≤2/sec, skipped under reduced motion). ~1-in-16 via the bag (§4.1).

## 6. Tuning parameters (spec defaults — change freely in playtest)

| Parameter | Default | Notes |
|---|---|---|
| `JACKPOT_MIN_GAP` | `8` | ordinary pulls before a jackpot is eligible |
| `JACKPOT_CHANCE` | `0.10` | per-eligible-pull probability (~1 in 16 overall) |
| anticipation duration | `~1100 ms` | rattle + flash before the reveal |
| bulb flash rate | `≤ 2/sec` | seizure-safe (no saturated red, small area) |
| reveal tween | `Bounce.easeOut` (drop) + `Back.easeOut` (scale) | ~450 ms |
| confetti | `bigParty` (reduced count under reduced-motion) | reuse |
| music volume | `~0.38` | low, so the fanfare stays crisp |

## 7. Audio

- **Dedicated music (new):** one upbeat, playful (toybox/carnival-ish) looping track for this mode,
  **sourced by the user**. To keep the build runnable before the final file lands, add
  `scripts/build-gumball-audio.mjs` (mirrors `build-pop-audio.mjs`) that downloads an upbeat CC-BY
  (Kevin MacLeod) default to `public/audio/gumball.mp3`, credited in `public/audio/CREDITS.md`;
  user-swappable. Loaded in Boot (key `gumball`), played **looping at low volume** with the same
  autoplay/unlock robustness used elsewhere, and **stopped on scene shutdown**.
- **SFX (reused):** `pop`/`collect` (button click), `fanfare` (ordinary payoff), `tada` (jackpot).

## 8. File structure

**Create:**
- `src/core/gumballs.ts` — pure shuffle-bag + jackpot (`createBag`).
- `src/core/gumballs.test.ts` — Vitest unit tests.
- `src/scenes/GumballScene.ts` — the mode's scene.
- `src/scenes/ui/PlayroomBackground.ts` — calm playroom background.
- `scripts/build-gumball-audio.mjs` — download a default CC-BY track → `public/audio/gumball.mp3`.
- Generated asset: `public/audio/gumball.mp3` (user-swappable).

**Modify:**
- `src/main.ts` — register `GumballScene` in the scene array.
- `src/scenes/TitleScene.ts` — add the fourth button **"🎁 Unicorn Gumballs"** (orange `0xff9f43`)
  → `this.go("Gumball")`, and **retune the four buttons' vertical spacing** (≈ y690/840/990/1140,
  gap 150) so all four fit above the bottom.
- `src/scenes/BootScene.ts` — load the `gumball` music track.
- `public/audio/CREDITS.md` — credit the default track.
- `package.json` — add the `gumball-audio` script.
- `README.md` — note the fourth mode + `npm run gumball-audio`.

## 9. Testing

- **Pure logic (`src/core/gumballs.test.ts`), Vitest:**
  - `next()` never returns the same ordinary cutie twice in a row (long run with `Math.random`).
  - Over a full bag cycle every cutie in `GUMBALL_ITEMS` appears.
  - Jackpot never appears before `JACKPOT_MIN_GAP` ordinary pulls; with a stub rng just below
    `JACKPOT_CHANCE` (once eligible) it returns `JACKPOT`; just above, it does not; two jackpots are
    never back-to-back.
  - Deterministic with a stubbed rng.
- **Scene layer:** not unit-tested (project convention). Verified by running the game in Claude
  Preview: the machine renders over the playroom; tapping plays squash → rattle + flash → tumble →
  confetti + fanfare; the button is locked (and wiggling) during a pull and re-enables after; no
  immediate repeats; the unicorn jackpot eventually appears with the bigger party; reduced-motion
  swaps in the glow-pulse; music loops; no console errors.

## 10. Open / deferred items

- Final music track selection (user sources it; the script provides a swappable default).
- Playtest tuning of §6 (anticipation length, jackpot rate, reveal feel) on the real device.
- Possible later: a parent mute toggle; an idle "bob" on the button to re-invite taps; `Bounce` vs
  `Back` reveal A/B.
