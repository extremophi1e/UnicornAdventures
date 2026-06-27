# Design Spec — Tap-to-Grow Garden (🌱 7th game mode)

**Date:** 2026-06-27
**Status:** Approved design — ready for an implementation plan.
**Research brief:** [`docs/superpowers/research/2026-06-27-tap-to-grow-garden-brief.md`](../research/2026-06-27-tap-to-grow-garden-brief.md)

---

## 1. Vision

A seventh mini-game for *Zoe and Desi's Rainbow Unicorn Adventures*. The child taps the
meadow and a seed sprouts and **grows into a flower, bush, or tree right where she touched** —
with a sparkle and a soft music-box note. Every tap visibly builds the garden: keep tapping and
the meadow fills, the plants grow up (flowers → bushes → trees), and butterflies drift out to
wander. When the meadow is lush it **blooms in a big celebration** — the whole garden she built
pops at once, a rainbow and the unicorn sweep across — then gently clears to fresh ground for
another round. Endless rounds, no-fail, no score. Pure, satisfying cause-and-effect: *I touched
it and something beautiful grew.*

This is a calm **creation sandbox**, the building cousin of Unicorn Gumballs — the reward is the
visible meadow, not a number.

## 2. Goals & success criteria

- **Instant, wordless start.** Drop into the meadow; the first tap *is* the tutorial. A soft
  glow invites where to tap.
- **Every tap delights and builds.** Touch-down registration, oversized forgiving area, a plant
  sprouts at the point every time. The meadow visibly accumulates.
- **The arc feels earned.** Build (~1–2 min) → big bloom → gentle clear → fresh canvas. The
  bloom is a real payoff; the reset reads as *"make room for more,"* never loss.
- **Never overstimulates.** The constant tapping makes *music* (ascending pentatonic notes),
  not a machine-gun click. Quiet ambient bed, global mute, `prefers-reduced-motion` honored.
- **Smooth on her phone.** Pooled sprites, y-sorted, single-scene-recycled; no GC churn or
  draw-call cliffs during a full-meadow clear.

**Done = ** Zoe can start in seconds with no reading, tap-grow a meadow on her own, reach the
bloom and grin, and the fresh round invites her back — on both PC and phone, at 60fps.

## 3. Non-goals (YAGNI)

No score/counter, no fail state, no timer shown, no progress saving, no level select, no
settings screen or in-app calm toggle (matches the project — calm mode/settings were removed;
`prefers-reduced-motion` is honored via `matchMedia` only, like Pop), no parental gate, no
in-app credits, no second gesture (no drag/pinch/double-tap — single tap only), no creature
"catching" (pollinators are decoration, not targets). 🐝 bee is included **only if** it probes
loop-safe in Noto's animated set; otherwise the second pollinator is 🐞 ladybug.

## 4. Target platforms & constraints

PWA on the user's Windows PC (mouse) and the kids' phone (touch), portrait-ish fixed logical
space (the existing `viewport.ts` adaptive width, ~520–720 wide × 1280 tall), Phaser 4 scale-to-
fit. Ages 3–5: ≥2 cm tap targets, hit area larger than art, no bottom-edge controls, gentle
audio. Zero data collection (no accounts/analytics), consistent with the rest of the game.

## 5. Player experience & flow

```
Title (2×4 grid) ──tap "🌱 Grow a Garden"──▶ GardenScene
                                               │
   ┌──────────────────────── round loop ───────┴────────────────────────┐
   │  BUILDING: tap meadow → seed sprouts & grows at the point,          │
   │            note plays, sparkle; plants climb flower→bush→tree;      │
   │            blooming plants release wandering butterflies;           │
   │            sky warms as it fills toward ~22 plants                  │
   │     ▼ (plant count hits target)                                     │
   │  CELEBRATING: whole meadow pops + bigParty + rainbow + unicorn      │
   │     ▼                                                               │
   │  CLEARING: plants wilt-fade in a staggered wave (~1s);              │
   │            1–2 butterflies linger                                   │
   │     ▼                                                               │
   │  → fresh bare ground + glow invite → BUILDING (next round)          │
   └─────────────────────────────────────────────────────────────────────┘
   ⬅ back button (top-right) → Title
```

No menus, no instructions, no end. Back arrow returns to the title (stops audio).

## 6. Core gameplay loop & mechanics

### 6.1 The tap

- **Touch-down registration**, single tap, anywhere on screen. One scene-level `pointerdown`
  handler (no per-sprite interactivity), mirroring Pop's input model.
- **Meadow band** (lower ~60% of the logical height): a tap grows a plant **at the exact tapped
  point**. The plant's **y sets its depth** — lower (nearer) plants render bigger and in front,
  higher (farther) plants smaller and behind (`setDepth(y)` at spawn).
- **Sky band** (upper ~40%): a tap emits a **gentle sparkle** (and may nudge a drifting cloud) —
  responsive, but no plant. The sky holds the sun, clouds, and wandering butterflies.

### 6.2 The maturity ladder (widening, weighted to the newest tier)

Gated by the current active plant count (`core/garden.ts`, pure + tested):

| Tier | Unlocks at (active plants) | Plants (emoji) | Note octave |
|------|-----|-----|-----|
| 1 — Flowers | from 0 | 🌱→ 🌸 blossom, 🌼 daisy, 🌷 tulip, 🌹 rose | low |
| 2 — Bushes  | ~ ⅓ of target | 🌱→ 🌿 herb/bush, 🌻 sunflower, 🌵 cactus | mid |
| 3 — Trees   | ~ ⅔ of target | 🌱→ 🌳 tree, 🌲 evergreen | high |

Each tap picks a plant from **all unlocked tiers, weighted toward the newest** — so flowers
remain scattered throughout while bushes then trees join in, giving a **layered, believable
meadow** (not a clump of trees). Crossing a tier threshold fires a **chord cue** (audible
"level-up"). Thresholds and the bloom target are tunable constants.

### 6.3 Growing a plant

1. Spawn a **🌱 sprout** at the tap point, `setScale(0).setOrigin(0.5, 1)` (anchored to its
   base so it rises *from the ground*), `setDepth(y)`. Its own ~24-frame emoji loop plays (free
   ambient life).
2. **Grow** with one tween: `scale 0 → 1`, ~600–800 ms, `ease: 'Back.Out'` (the "pop"). Optional
   organic bias: lead `scaleY` slightly, settle `scaleX`.
3. **Silhouette swap** near the end: `time.delayedCall(mid, () => plant.setTexture(finalForm))`
   — seed becomes the chosen flower/bush/tree. (Avoid `tweens.chain` + top-level delay — bug
   #7093; use `delayedCall` + concurrent tweens, the project standard.)
4. On grow-complete: a **sparkle** (`Celebrations.popAt`-style `explode(~12)`), the **pentatonic
   note** (§8.2), and a **pollinator-release roll** (§6.4).

### 6.4 Pollinators (decoration, not targets)

- On a plant's grow-complete, **release a creature** with probability **rising by tier** (flowers
  rarely → trees often), `core/garden.ts`-decided, capped at ~10–15 concurrent (pooled).
- Species: **🦋 butterfly** (baked) + **🐝 bee** *(if loop-safe)* **or 🐞 ladybug** (baked).
- It pops out at the bloom point and **wanders gently**: a per-creature looping `PathFollower`
  on a random `Curves.Spline` — `startFollow({ duration: 6000+, repeat:-1, yoyo:true,
  ease:'Sine.easeInOut', rotateToPath:true })` (or `flipX` to face) — slow, bounded, predictable
  (the brief: random/darting motion reads as chaos/fright to a 3-year-old). Depth re-derived from
  base-y as it moves.
- **Not tappable** — taps fall through to grow a plant. (A tiny "tapped butterfly does a loop"
  flourish is an explicit nice-to-have, not core.)

### 6.5 Bloom, clear, fresh canvas

- **Trigger:** active plant count reaches the target (~22, tunable) → `CELEBRATING`.
- **Sky-warming** has been easing the background toward golden-hour as the count climbed — a
  felt "almost there" with no number.
- **Bloom (lean BIG):** the **whole meadow pops at once** (synchronized `Elastic`/squash +
  sparkle on every plant) + `Celebrations.bigParty` (full-screen sparkle shower + the one
  allowed screen-shake) + a **rainbow banner** + `fanfare`/`tada` + the signature **unicorn
  (`catchUnicorn`) flies across** the meadow.
- **Clear:** plants **wilt-fade in a quick staggered wave** (reverse-grow `scale→0` + sparkle
  puff), ~1 s total — a natural finish, not an instant vanish.
- **Permanence token:** **1–2 butterflies linger** into the next round.
- **Fresh canvas:** bare ground returns with a soft glow/sparkle inviting the first tap →
  `BUILDING`.

### 6.6 Reduced motion (`prefers-reduced-motion: reduce`, via `matchMedia`)

Reduce, don't remove: grow → fast **fade-in** (or small 0.9→1, no `Back` overshoot); sparkle →
minimal `explode(~3)`; bloom → still "bloom" frame + one gentle fade, **no shake, no unicorn
streak**; **stop/greatly slow the wandering** (the main vestibular trigger); durations shortened
~40–60%. The plant's in-place emoji loop is kept (appearance, not spatial — safe).

## 7. Content / assets

- **New plant emoji** added to `scripts/build-emoji.mjs` (the proven `npm run emoji` pipeline,
  3rd-batch precedent), each **probed for loop-safety** (download GIF → compare first/mid/last
  opaque % ≥ ~15%; reject faders): 🌱 sprout (`1f331`), 🌼 daisy (`1f33c`), 🌻 sunflower
  (`1f33b`), 🌷 tulip (`1f337`), 🌹 rose (`1f339`), 🌿 herb (`1f33f`), 🌵 cactus (`1f335`),
  🌳 tree (`1f333`), 🌲 evergreen (`1f332`). 🌸 blossom already exists (`flower`/`1f338`).
  *(Probe may drop any that fade; the ladder degrades gracefully — minimum viable is sprout +
  blossom + one bush + one tree.)*
- **Pollinators:** 🦋 butterfly already baked; **probe 🐝 bee (`1f41d`)** — if it fades (memory
  flags it as previously rejected), use 🐞 ladybug (already baked as the `donut` key, `1f41e`).
- **Audio:** a pentatonic **note set** (music-box/marimba, ~5–8 notes across 2–3 octaves) and a
  calm **ambient track**, synthesized/sourced via a new `scripts/build-garden-audio.mjs`
  (lamejs, like `build-gumball-audio.mjs`); the ambient track is **user-swappable**.
- **Reuse:** `Celebrations` (bigParty/banner/popAt), `Sound` (fanfare/tada + new note/ambient
  hooks), `spawnEmoji`/`resetEmoji`, the OpenMoji `sparkle` atlas frame, the `catchUnicorn`
  sprite.

## 8. Visuals & audio

### 8.1 Visuals
- **`GardenBackground`** (new, own file like every mode): sky gradient (top) + meadow band
  (bottom) + a sun + slow drifting clouds, with a **sky-warming tween** driven by fill progress.
  Static apart from clouds/sun/warming.
- **Depth:** everything y-sorted by base-y; plants set depth **once** at spawn, creatures
  re-derive as they move; celebration FX on a depth ceiling with additive blend, isolated so it
  never breaks the sprite batch.
- **Atlas discipline:** all plant/creature frames ride the shared emoji sheets (one batch);
  keep additive glow/celebration on a separate top layer.

### 8.2 Audio (the make-or-break decision)
- **Per tap = the next note up a soft pentatonic scale**, ascending and wrapping, so constant
  tapping makes a *pleasant rising melody*, never a repeated click (pentatonic always sounds
  good in any order/speed). Octave biased by the current tier (flowers low → trees high). Soft,
  short, low-attack, peak-limited; voice-limited so rapid taps blend rather than stack.
- **Ladder-unlock** → a richer **chord** cue. **Bloom** → `fanfare`/`tada`.
- **Quiet ambient bed** (low volume, the tap-notes are the foreground; the brief warns loud
  music + constant SFX overloads under-5s). **Global mute** available; stop all audio on scene
  shutdown.

## 9. Architecture

- **Single `GardenScene`, recycled in place** (no `scene.restart()` per round). Round flags
  reset in `init()`.
- **Lifecycle FSM:** `BUILDING → FULL → CELEBRATING → CLEARING → BUILDING`, each `enter()` once.
- **Pools (Phaser Groups, not Containers):** one per plant tier (`flowers`, `bushes`, `trees`)
  + one `creatures`, pre-populated to max in `create()` then `killAndHide`-ed. Spawn =
  `pool.get(x,y)` → reset `scale`/`alpha`/`active`/`visible` + `killTweensOf` → grow.
  `countActive()` across plant pools is the "meadow full" signal.
- **Pure logic — `src/core/garden.ts` (Vitest-tested)**, no Phaser import: tier-unlock gating by
  count, tier-weighted plant pick, pollinator-release decision (prob by tier), bloom-target
  check, FSM transition rules, and a seeded RNG / shuffle-bag for plant variety (no immediate
  repeat), mirroring `core/catch.ts`/`pop.ts`/`gumballs.ts`.
- **Wander:** `PathFollower` per creature (zero-dep, no `Timeline`); spline through a few random
  bounded waypoints. (Noise-wobble steering is the documented alternative if perf/feel favors
  it — see brief Axis 2/3.)
- **Spawn-from-entity:** plant grow `onComplete` → `releaseCreature(x, y)` from the pool,
  sequenced with `time.delayedCall` + concurrent tweens (never `tweens.chain` + top-level
  delay — bug #7093).
- **Teardown (the #1 endless-round leak risk):** one `teardownAll()` — `tweens.killAll()` →
  `time.removeAllEvents()` → `killAndHide` every pool → `events.off(...)` — used by **both**
  round-clear and the `events.once('shutdown', …)` handler.
- **Title:** reflow `TitleScene`'s grid to **2×4**; Garden at row 4 left, **Aquarium slot (row 4
  right) reserved**; button `🌱 / "Grow a Garden" / 0x35c46a`; `go("Garden")`.

### Tuning constants (single source, scene-top + `core/garden.ts`)
`BLOOM_TARGET ≈ 22`, tier thresholds `≈ ⅓ / ⅔ × target`, `GROW_MS 600–800`, pollinator-release
prob per tier, `CREATURE_CAP ≈ 12`, wander `duration`/amplitude, clear stagger, particle budget,
note volume + voice-limit, ambient volume. All playtest-tunable.

## 10. Tech stack & delivery

Phaser 4 + TypeScript + Vite (unchanged). **New files:** `src/scenes/GardenScene.ts`,
`src/scenes/ui/GardenBackground.ts`, `src/core/garden.ts` + `tests/core/garden.test.ts`,
`scripts/build-garden-audio.mjs`. **Edited:** `scripts/build-emoji.mjs` (+ new plant/creature
codepoints, regenerate `public/emoji/*.png` + `src/render/emoji.ts` via `npm run emoji`),
`src/scenes/BootScene.ts` (load new sheets + note/ambient audio, register anims),
`src/main.ts` (register `GardenScene`), `src/scenes/TitleScene.ts` (2×4 grid + 7th button).
Runtime-verified in Claude Preview; unit tests via Vitest; `npm run build` clean. Merge to
`master` per the per-mode branch convention (branch `tap-to-grow-garden`).

## 11. Open questions (deferred to implementation / playtest)

1. **Does the reset read as loss?** Top playtest item — watch her face the instant the meadow
   clears. (Mitigation already in: child-caused bloom → inviting fresh canvas → lingering
   butterflies.)
2. **Audio ceiling tuning** — note volume, voice-limit count, ambient level: stays delightful at
   dozens of taps/min for the child *and* a parent in earshot?
3. **Is "full" earned?** Tune `BLOOM_TARGET` / tier thresholds so ~1–2 min feels like a real
   climb (Giggle Ghosts needed a *much* bigger reward than expected).
4. **Butterflies — delight or distract/scare?** Find the speed/density/cap ceiling.
5. **Is the ladder even noticed** by a 3–5-year-old? If not, it's dev-facing — don't over-invest
   art there.
6. **Bee loop-safety probe** — include 🐝, or fall back to 🐞 ladybug.
7. **Texture-swap pop vs. cross-fade** for the sprout→plant silhouette change if origins differ.
8. **Celebration particle budget** on a low-end phone during a full-meadow clear — scale
   `quantity`/`maxAliveParticles` down on weak devices and under reduced motion.
