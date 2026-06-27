# Peekaboo / Whack-a-Cutie — Research Brief

Date: 2026-06-27
Feature: a new no-fail "Peekaboo / Whack-a-Cutie" mode for Zoe & Desi's Rainbow
Unicorn Adventures. Cute animated-emoji critters peek out of hiding spots and duck
back after a short window; tap one before it hides for a **giggle + sparkle + point**.
The "now you see me" surprise distinguishes it from Pop's floating-rise tapping.

Intake decisions locked:
- **Placement**: **hybrid** — a fixed scatter of ~6–9 themed hiding spots (burrows &
  flower clumps on the grass, clouds in the sky) **plus occasional surprise pops**
  elsewhere. One emerge→hold→duck cycle; spot variety is cosmetic + placement.
- **Setting**: **mixed meadow + sky** (reuses the Catch meadow art style).
- **No-fail**: catching a critter = giggle + sparkle + point; a missed critter just
  ducks back (no penalty) and only gently nudges difficulty. Multi-touch (two kids).

---

## UX — Toddler whack-a-mole / peekaboo patterns

**Key findings**
- Tap is the only reliable gesture for ages 2–4; register feedback on **press-down**
  (`pointerdown`), not lift, within <50ms; combine **sound + animation** on every hit
  (the research-backed standard). Targets must be large (≥~75px, ideally far larger).
  (TIDRC 2019; Sesame Workshop 2012)
- **Up-time** (how long a critter stays catchable): children's simple reaction time is
  ~0.5–1s at 4–6, with huge variance and added *orientation* time, so toddlers need a
  generous window. Validated whack-a-mole "easy" ≈ 1500ms; the lab instrument uses
  1800ms for ages 7–12. **Start ~2000ms (up to ~3000ms for the youngest); never below
  ~1500ms.** Self-balance silently on a rolling hit-rate window (>~70–85% → shorten;
  <~30% → lengthen), clamped. (Miyaguchi 2013; ud5/millisecond whack-a-mole; dev RT lit)
- **One critter at a time** is the right baseline for 2–4s (they track ~1 moving
  object); push to 2–3 only with clearly separated screen zones for two players.
  (Giggle Ghosts case study; TrackFX MOT)
- **Hybrid placement is exactly right**: toddlers learn fixed spots (object
  permanence/anticipation = the peekaboo dopamine loop); rare surprise pops are
  delightful *because* the rest is predictable. Fully random frustrates. (Addyman/UCL;
  Benitez & Saffran 2018; Giggle Ghosts)
- The **"hide" is as important as the "appear"** — keep a clear duck-back animation.
  A brief **pre-reveal tell** (spot wiggles ~300–500ms before the critter emerges)
  helps toddlers orient and raises hit-rate without removing challenge (open question:
  telegraph every time vs only for the youngest).
- Feedback should **delight without overstimulating**: warm/rounded sound, **gentle**
  sparkle (not explosive), consistent volume, flashing <3/sec (WCAG 2.3.1). Research
  cautions against **numeric point scores** as the primary reward for this age (can
  overshadow intrinsic play); a visual collection reads better. (TIDRC FM33; Kokotree)
- Multi-touch is fine here (no "wrong answer"); two kids tapping simultaneously each
  get the reward; cooperative, not competitive framing. (Sesame; Nacher 2015)

**Recommendation**
Baseline **1 critter up at a time**, **~2000ms up-time** with a silent hit-rate
self-balance (floor ~1300ms, cap ~3000ms); scale toward 2 concurrent (separated
zones) as the child succeeds. Hybrid spots (fixed + ~15–20% surprise). Reward on
press-down: giggle + gentle `popAt` sparkle + a quick squash/stretch + duck-back.
Keep a subtle ⭐ counter for app consistency but make the giggle/sparkle the felt
reward (not the number). Brief pre-reveal spot tell to help orientation.

**Open questions** → design-grill
- Up-time start value + exact self-balance thresholds; does "up-time" include the
  emerge/duck animation or just full-visible dwell?
- Keep the ⭐ score counter (app consistency) or drop it (research preference)?
- Pre-reveal tell on every pop, or only early/at low difficulty?
- 1 vs 2 concurrent critters for two-kid play; zoned or free-for-all.

---

## Architecture — Spot state machine, scheduler, peek visual

**Key findings**
- Canonical model: a **per-spot state machine** `IDLE/COOLDOWN → EMERGING → VISIBLE →
  DUCKING`, driven by timers, kept **pure** (board-agnostic) and separate from
  rendering — the same pure/render split this codebase already uses (`core/` vs
  scenes). A **scheduler** picks which idle spot pops next and when (recursive timer,
  not fixed `setInterval`, since up-time and spawn interval are independent).
  (multiple whack-a-mole implementations; OpenCodingSociety OOP lesson)
- **Peek visual — depth-sorted foreground occluder is the clear winner**: draw the
  burrow/flower rim as a sprite at a higher `depth`; the critter at a lower depth
  tweens its `y` up from behind it (and ducks back behind it). No mask, no batch
  break, works on **both Canvas and WebGL**. For clouds, a simple scale-pop. (Phaser
  depth docs; Discourse depth-sort)
- **Avoid masks in Phaser 4**: `BitmapMask` is removed, `GeometryMask` is Canvas-only,
  WebGL uses Mask *Filters* which have an **open performance regression** (#7306, FPS
  drops, full-screen framebuffer for containers). Not worth it for 6–9 spots.
- **Pooling** via `Phaser.GameObjects.Group` (`get`/`killAndHide`); pre-create
  ~spotCount critters. Multi-touch: `input.activePointers` (set 4–5); each interactive
  critter receives its own `pointerdown`, no aggregation needed.
- **Difficulty**: two stepped lookups — `visibleWindowMs` (decreasing) and
  `maxConcurrent` (increasing) — plus a rolling hit-rate self-balance; ease **fast**
  toward easier, **slowly** toward harder (invisible AI-director style). Avoid
  **starvation** (track per-spot `cooldownUntil`; min cooldown; don't immediately
  re-pick the last spot).
- **Hit-window pitfalls**: guard against **double-count** (on first tap, transition
  out of VISIBLE so further taps no-op); give a **coyote window** (~+100ms accept past
  the duck start) so a slightly-late toddler tap still counts; enforce a min re-pop
  cooldown so a fresh critter can't inherit a stale tap.

**Recommendation**
Pure `core/peekaboo.ts`: a `SpotState` machine `tick(now)` + a `chooseSpawn(spots,
params, now, rng)` selector + difficulty lookup, all unit-tested. Scene
`PeekabooScene` consumes those decisions and drives a pooled critter per spot. **Peek
= depth-sorted occluder** (ground) + scale-pop (cloud), **no masks**. `activePointers`
≥4; per-critter `setInteractive`; on tap → state-guard (no double-count) + coyote
window. Reuse the `catch.ts` notch idea but map notch → `visibleWindowMs` +
`maxConcurrent` (a peekaboo-specific table), plus rolling hit-rate nudge.

**Open questions** → design-grill
- Do surprise (non-spot) pops use the same pool + a generic dust/sparkle puff
  occluder, or just scale-pop with no occluder?
- 1 vs 2+ concurrent (affects scheduler cap) — ties to the UX zoning question.
- Difficulty: reuse `catch.ts` `CatchState` (notch/catch/miss) for the ladder and add
  a peekaboo mapping, or a self-contained peekaboo difficulty model?

---

## Tech Stack — Phaser tweens, occlusion, giggle synthesis

**Key findings**
- **Emerge→hold→duck** = `scene.tweens.chain()`: emerge (`y` up / `scaleY`, `Back.Out`,
  ~250ms) → hold (timed dwell, randomised for varied timing) → duck (`y` down,
  `Power2.In`, ~150ms). On tap, `tweens.killTweensOf(critter)`, snap to caught state,
  then play the catch juice. A destroyed target auto-stops its tweens. (Phaser tween docs)
- **Occlusion confirmed: depth-sort foreground occluder**, not masks (see Architecture;
  Phaser-4 mask removal/regression). Depth-sort is zero-cost and Canvas-safe.
- **Giggle**: a literal voice giggle needs formant/vocal-tract modeling (heavy). The
  practical, reliable choice is a **stylized chime-arpeggio "tee-hee"** — 2–3 rising
  sine/triangle blips (~G5→B5→D6, staggered ~70ms, fast exp decay, optional bright
  highpass), which reads as happy/cute. Render **2–3 pitch variants** to avoid
  machine-gun fatigue on repeated catches. This fits the project's existing offline
  oscillator → lamejs MP3 pipeline exactly — **no new runtime/build deps** (hand-rolled
  like `build-audio.mjs` / the soundboard's `toneGen`). (MDN Web Audio; procedural-audio
  sources)
- **Multi-touch**: `input: { activePointers: 5 }` (≈4 fingers + mouse); per-critter
  `setInteractive()` fires independent `pointerdown`s.
- **Juice**: squash/stretch tween chain (~200ms) + `Celebrations.popAt` sparkle (cap
  ~8 particles on mobile) + optional brief tint flash; **skip camera shake** for
  toddlers (disorienting). Press-down trigger, <50ms response.

**Recommendation**
`tweens.chain` for emerge/hold/duck with `killTweensOf` cancel-on-tap. Depth-sort
occluder. A new `scripts/build-peekaboo-audio.mjs` (mirroring `build-audio.mjs`) that
synthesizes a small set of **giggle/“tee-hee” chime variants** (+ reuse existing pop
if needed) → `public/audio/…`; load in `BootScene`; add a `Sound.giggle()` method
(pitch-varied). `activePointers: 4`. Catch juice = squash/stretch + `popAt` + giggle,
no shake.

**Open questions** → design-grill
- One giggle with random detune at playback vs a few pre-baked pitch variants (simpler
  loader)?
- Hit area = full sprite (generous, toddler-friendly) vs restricted to the visible
  peeking portion?
- Background music: a dedicated loop (like Pop/Gumball) or reuse an existing track?

---

## Cross-cutting conclusions
1. **Depth-sorted occluder peek, no masks** — the single most important technical call;
   simple, performant, Canvas-safe, and exactly the "peek from behind" look.
2. **Pure `core/peekaboo.ts`** (spot state machine + spawn selector + difficulty) is the
   testable heart; the scene is thin rendering over it — matches the codebase pattern.
3. **Hybrid spots + ~2s up-time + silent hit-rate self-balance + 1→2 concurrent** is the
   research-backed toddler tuning; no-fail, gentle, multi-touch.
4. **Stylized chime "tee-hee" giggle**, hand-rolled offline synth, pitch-varied — fun and
   reliable; no new deps; reuses the established audio pipeline.
5. Reuse: `Celebrations.popAt`, `Sound`, emoji sheets, the meadow background style, and
   the `catch.ts` difficulty pattern. New: the peek mechanic, hiding-spot art, giggle SFX.
6. Likely **no separate calm-mode** (consistent with the soundboard decision), but keep
   sparkle gentle and flashing-safe by construction.
