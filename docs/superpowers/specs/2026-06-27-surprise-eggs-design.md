# Surprise Eggs — Design Spec

Date: 2026-06-27
Research brief: [docs/superpowers/research/2026-06-27-surprise-eggs-brief.md](../research/2026-06-27-surprise-eggs-brief.md)

**Goal:** A new no-fail **"Surprise Eggs"** mode for *Zoe and Desi's Rainbow Unicorn
Adventures*: **4 big pastel eggs wobble in a straw nest** on a barnyard scene; the child
hatches each with **3 forgiving taps** — every tap lands a visibly distinct crack stage
(*crack… crack… BURST*) — then the shell shatters into shards and a **random cute animal**
pops out with a fanfare. **Pure sandbox** (no score, no counter, no levels). After a hatch
the animal lingers ~2.5s, fades, and a **fresh egg drops into that nest spot** — endless.
A rare **golden egg** spawns shimmering (contents decided at spawn) and hatches the
**unicorn** jackpot with an extra-big party. Reached from a new title-screen button.

**Identity vs. existing modes:** the closest sibling is **Unicorn Gumballs** (tap → concealed
random animal + fanfare), but that is *one passive machine*. Surprise Eggs is the
**active-hatching** mode — multiple eggs, and the *child* does the cracking. (See brief §0.)

**Stack:** Phaser 4 + TypeScript + Vite (existing). Crack/shatter SFX synthesized offline
with `@breezystack/lamejs` (existing dev dep); a swappable music track. No new runtime deps,
no image assets — the egg, nest, and barnyard are drawn with `Graphics`; the revealed animal
reuses the existing animated-emoji sheets.

## Global Constraints
- **No-fail, no game-over, no score/HUD** except a ⬅ back button. Every hatch is
  self-contained and always rewarding (brief §1: counters/streaks are a documented harm
  for this age — hold the sandbox line).
- **3 taps to hatch, each tap = a concrete distinct crack stage drawn on the egg** (never an
  abstract progress meter). The burst always lands on the 3rd tap. (brief §1)
- **Forgiving touch:** the hit area is generously larger than the visible egg; register on
  **pointer-down**; tolerate off-center/lingering taps. **Multi-touch** (two kids at once) —
  sanctioned here because hatching has no "correct answer". (brief §1)
- **No separate calm mode** (consistent with the recent modes). **Photosensitivity-safe by
  construction:** no rapid strobe, no camera shake, the golden shimmer stays slow (sub-1Hz)
  and avoids saturated red. A **reduced-motion** path honours `prefers-reduced-motion`. (brief §3)
- **`src/core/` stays import-pure** (no Phaser / `render` imports), Vitest-tested; rendering
  and all timing/animation live in the scene ("commands in → events out"). (brief §2)
- Seeded/`Math.random`-injected RNG in core; **no `Date.now()`** in core. (brief §2)
- TypeScript strict with `noUnusedLocals` + `noUnusedParameters`.
- On-screen emoji size rule: displayed px = `setScale × 144` (the revealed animal reuses this).

---

## 1. Pure logic — `src/core/eggs.ts` (Vitest-tested)

The mode's only genuinely new rule is the **3-tap hatch progression**; everything else reuses
already-tested core. Keep this module lean (brief §2: "the lightest representation — an
integer stage advanced on tap — is appropriate").

```ts
// The egg's crack FSM. intact --tap--> crack1 --tap--> crack2 --tap--> burst.
export type Stage = "intact" | "crack1" | "crack2" | "burst";

export const TAPS_TO_HATCH = 3; // taps from intact to burst
export const CLUTCH_SIZE = 4;   // eggs visible at once (one per nest slot)

// Advance one crack stage. `burst` is terminal (idempotent) so a stray tap on an
// already-hatched/disappearing egg is a harmless no-op — this also makes two
// simultaneous taps on the same egg safe (it can never "double-burst").
export function nextStage(stage: Stage): Stage;

// True once the egg has fully hatched (reached burst this tap).
export function isHatched(stage: Stage): boolean; // stage === "burst"
```

**Reused, already-tested core (no new code):**
- **Contents picker:** the shuffle-bag `createBag(rng, items)` from `src/core/gumballs.ts`
  — full 61-emoji set (`Object.keys(EMOJI)`), no-immediate-repeat, gated **unicorn jackpot**
  (`JACKPOT`). **One bag is shared across all 4 nest slots**, drawn once per refill, so
  no-repeat and jackpot gating stay global (brief §2 open-q resolved: shared, not per-slot).
- **Multi-touch hit test:** `pickNearestWithinRadius(px, py, points, radius)` from
  `src/core/pop.ts`.

**Contents decided at spawn** (brief §2, WoW-loot pattern): when a slot is filled the scene
calls `bag.next()` once and stores the result on the egg. `contents === JACKPOT` ⇒ render a
**golden** egg from birth; the burst merely *reveals* the already-chosen contents (no second
draw — deterministic under the seed).

**Tests** (`tests/core/eggs.test.ts`):
- `nextStage` walks `intact→crack1→crack2→burst` and `nextStage("burst") === "burst"`
  (idempotent / terminal).
- Applying `nextStage` `TAPS_TO_HATCH` times from `intact` reaches `burst`; `TAPS_TO_HATCH - 1`
  times does **not** (`=== "crack2"`).
- `isHatched` is true only for `burst`.
- `CLUTCH_SIZE === 4`, `TAPS_TO_HATCH === 3` (guards against accidental retune breaking copy).

---

## 2. Scene — `src/scenes/EggsScene.ts` (key `"Eggs"`)

Registered in `src/main.ts` after the other scenes. Mirrors `GumballScene`/`PopScene`
structure (pooling, reduced-motion flag, robust music autoplay, ⬅ back).

**Background.** A new static `src/scenes/ui/EggsBackground.ts` (see §3), depth `-10`.

**Nest + egg layout.** One big straw nest drawn in the lower-centre holds the 4 eggs in a
gentle **2×2 cluster** (shallow arc), spaced so each is a big, non-overlapping target clear of
the top-right ⬅ button. Slot anchors (responsive), e.g. around `nestY ≈ 0.60H`:
`(W/2 − 0.20W, nestY − 70)`, `(W/2 + 0.20W, nestY − 70)`,
`(W/2 − 0.22W, nestY + 80)`, `(W/2 + 0.22W, nestY + 80)` (clamped to keep eggs on-screen).

**Egg view.** Each egg is a small `Container` at its slot anchor:
- **Shell:** a `Graphics` egg shape — the asymmetry curve `x²/a² + y²/b²·(1+kx)=1` (small `k`
  for the pointed top) sampled to a polygon and filled with the egg's pastel colour, plus a
  soft white glossy highlight and a few darker speckle dots. (brief §3)
- **Ordinary egg colour:** picked from a soft pastel set
  `[pink, sky, butter, mint, lavender, peach]`; per-egg, varied for charm.
- **Golden egg:** metallic-gold fill + `postFX.addShine()` slow sweep + an occasional small
  sparkle (atlas `sparkle`). Reads as "special" by **motion**, so it's unmistakable even among
  pastels. (brief §1, §3)
- **Crack overlay:** a child `Graphics` above the shell, redrawn per stage (see §2 crack).
- **Hit area:** no per-egg `setInteractive`. Input is dispatched scene-level (below) by
  `pickNearestWithinRadius` using `EGG_HIT_RADIUS 100` — a radius generously **larger than the
  visible egg**, so off-centre taps still count (brief §1).

**Wobble (the "tell").** Each egg rocks in place: a looping tween
`{ angle: ±WOBBLE_DEG, ease: "Sine.easeInOut", yoyo: true, repeat: -1, duration: WOBBLE_MS }`
with a per-egg phase offset so they're not synchronised. (brief §1, §3)

**Tap → crack (scene-level dispatch).** `this.input.addPointer(3)` (up to 4 fingers) + ONE
`this.input.on("pointerdown", …)`; on each pointerdown, `pickNearestWithinRadius` over the
**intact/cracking** eggs' anchors (radius `EGG_HIT_RADIUS`). Ignore burst/empty slots. On a hit:
1. `core.nextStage(egg.stage)` → new stage; store it.
2. **Feedback every tap:** a quick squash tween (`scaleX×1.12, scaleY×0.9`, ~90ms yoyo) + a
   rising **"tok" SFX** (`Sound.crack(stage)`, pitch rises crack1→crack2→crack3) + redraw the
   crack overlay for the new stage. (brief §1: immediate combined audio+visual)
3. If the new stage is `burst` → **hatch** (below).

This avoids the `setInteractive` depth/top-only gotchas and keeps hit logic unit-testable
(brief §2). No debounce needed — `nextStage("burst")` is idempotent, so two simultaneous taps
on the same egg are safe (worst case it hatches one tap sooner).

**Crack overlay redraw (Approach B — fixed redraw stages).** One `Graphics`, `clear()`ed and
re-stroked with hand-tuned jagged lines (dark, ~3px). The FSM has two drawn crack stages; the
3rd tap bursts:
- `crack1` (after tap 1): one short jagged seam near the top.
- `crack2` (after tap 2): that seam + a branch.
- burst tap (tap 3 → `burst`): briefly flash a full crack web (~80ms) for read-out, then hide
  the shell and shatter (§ hatch).
The three distinct per-tap outcomes the child sees are therefore *crack → crack → BURST* (the
burst is the third feedback — satisfies brief §1's "three concrete stages"). Lines are fixed
coordinates (identical across eggs — fine for the audience, far less code than a procedural
generator). (brief §1, §3)

**Hatch (burst).**
1. Kill the egg's wobble (`killTweensOf`), hide the shell + crack overlay.
2. **Shatter:** the shared pooled emitter (§ shatter) `setPosition(egg.x, egg.y)` +
   `explode(BURST_PARTICLES)`, tinted to the egg's shell colour (gold for golden).
3. **Reveal the animal:** a pooled animal sprite (`spawnEmoji`/`resetEmoji`) at the egg
   position, `scale 0 → ITEM_REVEAL_SCALE` (`Back.easeOut`) with a small rise; the revealed
   sprite is **not interactive** (tapping it does nothing).
   - Ordinary: `Celebrations.popAt(x,y)` + `Celebrations.bigParty()` + `Sound.fanfare()`.
   - **Golden/jackpot** (`contents === JACKPOT`): reveal the **unicorn** (`catchUnicorn` sheet)
     instead, `Celebrations.bigParty()` + `Celebrations.banner("🌈")` + `Sound.tada()` + a slow
     pink glow (mirrors the Gumball jackpot). (brief §1, §2)
4. **Linger → fade → refill:** after `REVEAL_HOLD_MS` (~2500), fade the animal out (~250ms,
   `killTweensOf` + recycle in `onComplete`), mark the slot empty, then after `REFILL_DELAY_MS`
   (~400) spawn a **fresh egg** that **drops into the slot** with a little `Bounce.easeOut` —
   contents from `bag.next()`. Population self-caps at `CLUTCH_SIZE` (only empty slots refill).

**Pooling & hygiene** (brief §2): two `Phaser.GameObjects.Group` pools (egg containers;
revealed-animal sprites). On reuse reset `active/visible/alpha/scale/angle/tint`; always
`this.tweens.killTweensOf(target)` before recycling/re-tweening. **One** shatter emitter created
once with `emitting:false` — never re-created per hatch. `SHUTDOWN`: stop music, `stopAll`,
emitter is destroyed with the scene.

**Music.** A dedicated looping `eggsmusic` track (low volume ~0.38), **user-swappable**, with
the established robust autoplay (immediate + 200ms retry + unlock/first-tap) and stop-on-SHUTDOWN
(copy from `GumballScene`/`PopScene`).

**Back.** Plain top-right `⬅` → `scene.start("Title")`.

**Reduced motion** (`reduceMotion` from `matchMedia("(prefers-reduced-motion: reduce)")`):
drop the wobble + golden shine; replace the shard `explode` with a quick shell fade/scale;
fewer celebration particles (`BURST_PARTICLES_REDUCED`); no glow pulse. (brief §3)

**Scene constants:** `CLUTCH_SIZE 4`, `TAPS_TO_HATCH 3` (from core), `EGG_HIT_RADIUS 100`,
`WOBBLE_DEG 5`, `WOBBLE_MS 550`, `REVEAL_HOLD_MS 2500`, `REFILL_DELAY_MS 400`,
`BURST_PARTICLES 14`, `BURST_PARTICLES_REDUCED 5`, `ITEM_REVEAL_SCALE (2.2/2)*1.3`,
`JACKPOT_REVEAL_SCALE 0.85*1.3`, music volume `0.38`, crack SFX volume `0.6`.

---

## 3. Background — `src/scenes/ui/EggsBackground.ts` (cozy barnyard)

Static, shape-drawn with `Graphics` (no image assets, no animation needed — keeps the eggs the
clear stars, per brief §1). Built once in the ctor; a no-op/parallax-free `update` for signature
parity with the other backgrounds.
- **Sky:** `fillGradientStyle` soft blue (top) → pale (horizon).
- **Sun:** a soft warm circle upper-area (static; a faint halo, no strobe).
- **Ground:** a rolling green grass band (gradient) across the lower ~40%.
- **Barn + fence:** a simple red barn silhouette (rect + triangle roof + door) and a white
  picket fence line in the mid-ground.
- **Straw nest:** layered radiating thin gold/brown `lineBetween` strokes forming a woven
  ellipse in the lower-centre, where the 4 eggs sit. (brief §3)

---

## 4. Audio — `scripts/build-eggs-audio.mjs` (`npm run eggs-audio`)

One script, mirroring `scripts/build-peekaboo-audio.mjs` (same `SAMPLE_RATE 44100`, `CHANNELS 1`,
`encodeToMp3`, envelope helpers). Produces all egg audio:

**Crack / shatter SFX** (filtered-noise percussion, brief §3):
- `crack1/2/3.mp3`: a tiny (~8ms) exponential-decay white-noise burst through a **bandpass**
  at rising centres (~3.5k / 4.2k / 5k Hz, Q≈3) — the three "tok" taps, rising in pitch.
- `shatter.mp3`: a longer (~160ms) bandpassed noise burst, `gain` 0.9→0.001 exp decay, with
  a fast downward pitch transient for body.

**Music:** fetch a default **CC-BY** gentle loop → `public/audio/eggsmusic.mp3` (mirrors
`build-gumball-audio.mjs`); **the user will swap for their own track**, credited in
`public/audio/CREDITS.md`.

Add npm script `"eggs-audio": "node scripts/build-eggs-audio.mjs"`.

### `BootScene.preload()` — load the new audio
```ts
this.load.audio("crack1",  ["audio/crack1.mp3"]);
this.load.audio("crack2",  ["audio/crack2.mp3"]);
this.load.audio("crack3",  ["audio/crack3.mp3"]);
this.load.audio("shatter", ["audio/shatter.mp3"]);
this.load.audio("eggsmusic", ["audio/eggsmusic.mp3"]);
```

### `src/audio/sound.ts` — add helpers
```ts
const CRACK_KEYS = ["crack1", "crack2", "crack3"] as const;
// Play the crack "tok" for a given crack stage (1,2,3) — rising pitch built into the assets.
crack(stage: number, volume = 0.6): void {
  const k = CRACK_KEYS[Math.min(Math.max(stage, 1), 3) - 1];
  this.scene.sound.play(k, { volume });
}
shatter(volume = 0.7): void { this.scene.sound.play("shatter", { volume }); }
```
(The animal-pop flourish + golden party reuse the existing `fanfare()` / `tada()`.)

---

## 5. Title — add the 🥚 button (adaptive grid)
`src/scenes/TitleScene.ts`: add a **🥚 Surprise Eggs** button → `go("Eggs")`, colour
**`0xb39ddb`** (soft lavender — the warm/pink/orange/yellow/cyan/green slots are taken).

**Layout adapts to whatever modes exist when this merges** (Peekaboo's spec already converts the
single column to a **2×3 grid for 6**; +Eggs makes **7** → a **2-col × 4-row** grid, last row
single/centred). The implementer slots the new button into the current grid and resizes rows;
if only the single-column `makeButton` exists at integration, convert to the grid then. Keep the
existing `go(key)` audio-unlock gate and title-music logic. (Decision: adaptive, not a
hard-coded end-state, because Aquarium/Peekaboo merge order is unknown.)

---

## 6. File changes summary
- **Create** `src/core/eggs.ts` — `Stage`, `nextStage`, `isHatched`, `TAPS_TO_HATCH`, `CLUTCH_SIZE`.
- **Create** `tests/core/eggs.test.ts` — the Vitest cases in §1.
- **Create** `src/scenes/EggsScene.ts` — the scene (key `"Eggs"`).
- **Create** `src/scenes/ui/EggsBackground.ts` — static barnyard.
- **Create** `scripts/build-eggs-audio.mjs` — synth crack1/2/3 + shatter + fetch eggsmusic.
- **Modify** `src/scenes/BootScene.ts` — load crack1/2/3, shatter, eggsmusic.
- **Modify** `src/audio/sound.ts` — add `crack()` + `shatter()`.
- **Modify** `src/scenes/TitleScene.ts` — add the 🥚 Surprise Eggs button (adaptive grid).
- **Modify** `src/main.ts` — register `EggsScene`.
- **Modify** `package.json` — `eggs-audio` script.
- **Generated (commit)** `public/audio/crack1.mp3`, `crack2.mp3`, `crack3.mp3`, `shatter.mp3`,
  `eggsmusic.mp3` (+ `CREDITS.md` entry for the music).

## 7. Verification
- `npx tsc --noEmit`; `npm test` (existing suite + new `eggs` tests); `npm run build`.
- `npm run eggs-audio` generates the 5 MP3s (each small, non-empty).
- Preview: from the title open Surprise Eggs; confirm 4 pastel eggs wobble in the nest, each tap
  cracks (distinct stage + rising tok), the 3rd tap shatters + reveals a random animal + fanfare,
  the animal fades and a fresh egg drops in, a golden egg shimmers and hatches the unicorn with
  the big party, multi-touch works, reduced-motion path is calm, zero console errors.

## 8. Open items (resolved during implementation)
- Exact crack-line shapes, egg-curve `k`, pastel palette, and nest weave need an eye pass for charm.
- Crack/shatter timbre + the gold-shine cadence need an ear/eye pass within the photosensitivity limit.
- Wobble/reveal/refill timings are seeded from research; tune in the preview (esp. with the ~2yo).
- The default `eggsmusic` track is a placeholder; user swaps it.
- Title grid specifics are finalised at integration against whatever modes are merged.
