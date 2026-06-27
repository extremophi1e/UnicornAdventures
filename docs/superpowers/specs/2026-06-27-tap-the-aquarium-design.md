# Design Spec — 🐠 Tap the Aquarium

**Date:** 2026-06-27
**Status:** Approved (grilled brainstorm). Ready for `writing-plans`.
**Research brief:** [`docs/superpowers/research/2026-06-27-tap-the-aquarium-brief.md`](../research/2026-06-27-tap-the-aquarium-brief.md) — authoritative input; this spec assumes its findings.
**Stack:** Phaser 4 + TypeScript + Vite, Vitest for pure logic, Netlify PWA. 6th game mode in *Zoe and Desi's Rainbow Unicorn Adventures*.

---

## 1. Purpose & identity

A calm, **non-destructive aquarium sandbox**. Cute sea-creatures drift **horizontally** across a fish tank; tapping one triggers a **playful surprise** — the creature is **never destroyed**. There is **no score, no fail, no HUD** (just a ⬅ back button).

The mode's job — a living fish-tank to poke at, where *every tap is a guaranteed delight and you never know which one you'll get*. This is deliberately distinct from **Pop the Cuties** (which is *destroy-to-score*, vertical, and also underwater): Aquarium is horizontal, additive/playful, goal-less.

**Chosen approach:** the *full surprise engine* (Approach B) — a rich reaction catalog incl. morph + treasure chest, a pity/shuffle selection so the rare jackpot reliably lands, and a gentle "sleepy fish" anti-frenzy damper.

### Design tenets (from UX research)
- **Surprise, not Skinner box.** Variety/novelty delights 3–4-year-olds, but a *variable-ratio reward loop* is a documented harm. So: **no counter, currency, collection meter, or "tap to unlock."** Each tap is self-contained and *guaranteed* a pleasant reaction; rarity only varies *which* one.
- **Calm, not frantic.** Slow ambient drift; the tank is rewarding just to watch. Warm, rounded sounds; soft sparkles over explosive pops.
- **Unbreakable.** No fail state, no way to empty or overflow the tank, no frozen duds. Toddler-mashing-safe.

## 2. Success criteria
- **Delight-per-tap:** every tap does something visibly different often enough that the kids keep tapping; rare jackpots make them go "whoa."
- **Unbreakable & smooth** on her phone, however a toddler mashes it (incl. multi-touch).
- **Calm, not overstimulating:** photosensitivity-safe, `prefers-reduced-motion` path.
- **Visibly its own mode** — reads as a fish tank, not "Pop again."

## 3. Mechanics

### 3.1 The flowing tank
- **Baseline ~6–8 fish** drift horizontally (each fish has its own speed + a gentle vertical sine bob). Fish enter from one edge; if never tapped they exit the far edge and are **recycled** back in from a random edge/height — so there's always gentle traffic even if the kid does nothing.
- **Hard cap ~16 concurrent** (performance guard).
- A small spawn loop **maintains the baseline**: while `activeCount < BASELINE`, spawn one on an interval; never exceed `CAP`.
- Each fish is a pooled animated-emoji sprite (`Phaser.Group`, `getFirstDead`/`killAndHide`), reusing `spawnEmoji`/`resetEmoji`.

### 3.2 Tapping
- **Multi-touch** (`this.input.addPointer(3)`), one scene-level `pointerdown` → **`pickNearestWithinRadius`** (reuse `src/core/pop.ts`) with a **generous radius** (≈90px, padded beyond the sprite) for small fingers. Every simultaneous touch fires its own reaction.
- Reactions are **fire-and-forget and safe to overlap/re-trigger** — rapid re-tapping the same fish can't break anything (split is cap-bounded; tweens are killed before reuse).

### 3.3 Reaction catalog (full set)

| Tier | Reaction | What happens | Additive? |
|------|----------|--------------|-----------|
| Common | **Spin** | happy 360° twirl | no |
| Common | **Wiggle** | quick shimmy/jiggle (±15° yoyo) | no |
| Common | **Bubble-puff** | small bubble burst from the fish | no |
| Common | **Squash** | scale "boing" (squash-and-grow yoyo) | no |
| Common | **Color-flash** | one rainbow tint sweep, then restore | no |
| Common | **Heart-pop** | a little heart floats up off the fish | no |
| Uncommon | **Split** | becomes two fish; both drift on | **yes (+1)** |
| Uncommon | **Bubble-stream** | a rising column of bubbles that pop | no |
| Uncommon | **Zoom-burst** | dashes across the tank to a new spot | no |
| Uncommon | **Morph** | puffs and returns as a *different* sea creature | no |
| Uncommon | **Backflip** | a single loop-the-loop | no |
| Uncommon | **Giant** | briefly balloons huge, then back | no |
| Rare | **School** | 3–4 mixed friends swim in to join | **yes (+k)** |
| Rare | **Rainbow shockwave** | slow rainbow sweep; every fish reacts in a staggered wave | no |
| Rare | **Treasure chest** | a chest rises + pops open into a gem/sparkle/bubble fountain + fanfare | no |

Target combined odds: **Common ~65% / Uncommon ~30% / Rare ~5%**.

### 3.4 Selection engine (pure, `src/core/aquarium.ts`)
`pickReaction(state, rng, { atCap })` → `{ reaction, nextState }`. Deterministic with a seeded `rng`. State carries `tapsSinceRare` and `lastReactionId`.

1. **Cap-filter first.** If `atCap`, remove **additive** reactions (Split, School) from the available pool before anything else. (Shockwave + Treasure remain, so a rare is always available even at cap.)
2. **Tier pick with pity + min-gap:**
   - `MIN_GAP = 6`: a rare can't fire within 6 taps of the last (during the gap its weight is redistributed to Common/Uncommon).
   - `PITY_CEILING = 22`: if 22 taps pass with no rare, **force** a rare on the next tap.
   - Otherwise rare fires at its normal ~5%. Net: a jackpot **every ~12–22 taps**, never back-to-back, exact timing unknown.
3. **Within-tier:** uniform pick, **no-immediate-repeat** (re-roll if `id === lastReactionId`, reusing the `findIndex` de-seam trick from `gumballs.ts`).
4. **Update state:** rare → `tapsSinceRare = 0`, else `+= 1`; set `lastReactionId`.

Constants (`MIN_GAP`, `PITY_CEILING`, tier weights, per-reaction membership) live as data at the top of `aquarium.ts` for easy tuning.

### 3.5 Population helpers (pure)
`netAdds(reaction, remainingCapacity)` → how many creatures this reaction adds (0 / 1 / clamped `schoolCount`). School clamps to remaining capacity. Keeps spawn math headless-testable; the scene owns the sprites.

### 3.6 Sleepy-fish damper (per-fish, cosmetic)
- A small **per-fish tap counter** increments on tap and **decays** over ~2 s in `update`.
- At ~**5 rapid taps** the fish **naps**: slows its drift, droops/tilts, shows a **💤** above it, desaturated tint, for ~**2.5 s**. Tapping while napping gives only a sleepy mumble (tiny wiggle) — **no** big reaction. Then it **wakes** (pop-upright + sparkle) and resumes.
- Per-fish (not global), so it nudges the kid to tap *other* fish — which increases variety. Purely cosmetic/timing; lives in the scene (threshold constant is the only "logic"). Can't break anything — a napping fish still drifts, recycles, and wakes.

### 3.7 The three jackpots
- **School** — 3–4 mixed-species friends swim in from an edge. **Cap-aware** via `netAdds` (only as many as fit; filtered out entirely at cap). Fanfare.
- **Rainbow shockwave** — a **slow, gentle** rainbow tint sweep (NOT a strobe; flashes well under 3/sec, low-contrast). Every active fish reacts in a **staggered `delayedCall` wave** (small spin/wiggle in turn). Reduced-motion → a single soft tint pulse, no camera flash, shorter wave.
- **Treasure chest** — a **shape-based chest** (drawn with `Graphics`, no new asset) rises from the sandy floor beneath the tapped fish; the lid pops open (`Back.easeOut`) with a sparkle flash; a **fountain** erupts (bubble-stream + sparkle burst + a handful of `gem` sprites that float up and fade) + fanfare + rainbow banner; then the chest sinks back. **Non-additive, nothing to collect** (the tapped fish keeps drifting) — always cap-safe.

## 4. Cast
- **Already in the emoji set (8 aquatic):** 🐋 whale, 🐢 turtle, 🐙 octopus, 🦀 crab, 🦞 lobster, 🪼 jellyfish, 🐧 penguin, 🦭 seal.
- **New — add to the global set via `build-emoji.mjs` + opacity probe (verified present in Noto animated):** 🐟 fish (`1f41f`), 🐡 blowfish (`1f421`), 🦈 **shark** (`1f988`, *in* — Noto's is a cute cartoon), 🦦 otter (`1f9a6`), and 🐬 dolphin (`1f42c`) **only if it passes the loop probe** (prime "fades mid-loop" suspect — drop if it fails).
- **No tinted variants.** 🐠 tropical-fish (`1f420`) is 404 in the animated set; it lives on as the **title-button glyph** only. (Permanent tints would fight Color-flash/Morph.)
- The aquarium's **own cast** is a curated subset constant in the scene (like `POP_ITEM_TYPES`); the new emoji are additive to the global set, so Pop the Cuties also gains them (fine).

## 5. Visuals — `src/scenes/ui/AquariumBackground.ts` (new, shape-based)
Distinct from Pop's `UnderwaterBackground`: **brighter blue→aqua** water gradient, a **sandy floor** band, a few **swaying kelp** fronds, 2–3 **coral/rock** clumps, gentle **rising bubbles** + soft light rays. Calm, low-contrast so it never competes with the fish. `resize()`/`update()` like the other backgrounds; depth `-10`.

## 6. Audio
- New `scripts/build-aquarium-audio.mjs` → `public/audio/aquarium.mp3` (CC-BY default, **user-swappable** like every mode), looping, quieter than SFX. Robust autoplay (immediate + 200ms retry + unlock/first-tap), stopped on shutdown — copy `PopScene`'s wiring exactly.
- **Reaction-matched SFX:** reuse `pop`, `Celebrations.fanfare/tada`, atlas `sparkle`; add a small handful of distinct ones — a **blub** (bubbles), a **sproing** (split), a **chime** (jackpot). Detuned/fire-and-forget for variety.

## 7. Architecture & module structure (mirrors Pop/Gumball)
- **`src/core/aquarium.ts`** *(pure, no Phaser import — Vitest-tested)*: reaction catalog data + `pickReaction` (pity/min-gap/no-repeat + cap-filter) + `netAdds`. Seeded RNG injected. The single source of truth for *which reaction* and *how many it adds*.
- **`src/core/aquarium.test.ts`**: see §9.
- **`src/scenes/AquariumScene.ts`** (scene key `"Aquarium"`): owns the `Group` pool, a small set of **reused** particle emitters (reposition + `explode()`, never re-create per tap), multi-touch via `pickNearestWithinRadius`, the reaction **dispatch** (a handler per reaction `kind`), drift-recycle, the sleepy damper, the jackpots, and music. Mirrors `PopScene` structure.
- **`src/scenes/ui/AquariumBackground.ts`** (new).
- **`scripts/build-aquarium-audio.mjs`** (new); extend **`scripts/build-emoji.mjs`** `TYPES` with the 5 new creatures → regenerate `public/emoji/*.png` + `src/render/emoji.ts`.
- **Wiring:** register the scene + load `aquarium` music + new emoji sheets/anims in `BootScene`; add the 6th title button + the two renames in `TitleScene` (see §10); register the scene in the game config.

**Lifecycle discipline (from the brief, non-negotiable):**
- `killTweensOf(sprite)` + clear any stored per-fish timers/tweens **before** recycling or reusing a fish (the `clearRainbow`-style pattern already in `PopScene`).
- Reset `active/visible/alpha/scale/angle/tint` on pool reuse.
- One emitter per visual, reused; `stop(); destroy()` emitters + `killTweensOf` all + stop music on scene `SHUTDOWN`.

## 8. Phaser 4 specifics (from the brief)
- **No `setTintFill()`** — use `setTint(0xRRGGBB)` for color-flash (then `clearTint()` / restore).
- **No Tween Timeline** and **don't use `this.add.timeline`** for duration-driven sequences (it ignores tween `duration`). **Sequence with `this.time.delayedCall` + chained/concurrent tweens** (the repo's existing Gumballs rule).
- **`this.cameras.main.flash(duration, r, g, b)`** for the shockwave's screen pulse (no extra dependency; no rex shockwave filter).
- Particles: `explode(n)` for puffs, `flow`/`frequency>=0` for streams. **Zero new npm deps.**

## 9. Testing
**Pure unit tests (`aquarium.test.ts`, Vitest):**
- `PITY_CEILING` forces a rare: at `tapsSinceRare = 22`, the next pick is a rare.
- `MIN_GAP` blocks back-to-back: with `tapsSinceRare < 6`, no rare across many seeded draws; immediately after a rare, the next is never rare.
- **Cap-filter:** with `atCap`, Split and School are never returned (but Shockwave/Treasure still can).
- **No-immediate-repeat:** the returned id never equals `lastReactionId`.
- `netAdds`: School clamps to remaining capacity; non-additive reactions add 0; Split adds 1 (0 if full — but Split is cap-filtered, so this is defensive).
- Distribution sanity over many seeded draws (Common ≈65% / Uncommon ≈30% / Rare ≈5% within tolerance, accounting for pity).

**Runtime verification (Claude Preview, like the other scenes — not unit-tested):** 6 title buttons + 2 renames; fish drift + recycle; tap fires varied reactions; split/school respect the cap; sleepy fish naps + wakes; each jackpot renders; reduced-motion path; no console errors; `tsc` + `vite build` clean.

## 10. Title changes (`TitleScene`)
- **Add a 6th button:** scene key `"Aquarium"`, glyph **🐠**, label **"Tap the Aquarium"**, color **ocean blue `0x0077b6`** (distinct from Soundboard's cyan `0x00b4d8`).
- **Renames (display labels only — scene keys unchanged):** `"Rainbow Shoot"` → **"Star Blaster"** (key stays `"Game"`); `"Rainbow Catch"` → **"Catch the Cuties"** (key stays `"Catch"`).
- **Re-space the 6 buttons** to ~116px spacing nudged up a touch — fits within the fixed `LOGICAL_HEIGHT` 1280 (Scale.FIT). Keep the existing `makeButton` separate-emoji-then-label layout.

## 11. Out of scope / non-goals
- No score, count, currency, collection, persistence, or unlocks (by design — see tenets).
- No new engine/library dependencies.
- No changes to other modes' gameplay (the new emoji are additive only).

## 12. Deferred / open questions (from the brief, not blocking)
- **Younger sibling (~2)** experiences this as pure cause-and-effect rather than rarity-surprise — design targets the 4-year-old lead; the 2-year-old still gets guaranteed delight per tap.
- **Reduced-motion as default?** Shipping full-motion as default + honoring `prefers-reduced-motion`; revisit if it feels too busy on-device.
- **Dolphin** inclusion is gated on the loop probe.
- On-device **playtest** (touch feel, drift speed, jackpot frequency) is the real tuning pass — all knobs (`BASELINE`, `CAP`, `MIN_GAP`, `PITY_CEILING`, drift speed, radius) are constants.
