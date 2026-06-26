# Rainbow Catch — Research Brief

**Date:** 2026-06-26
**Feature:** A second, standalone game mode for *Zoe's Rainbow Unicorn* (Phaser 4 + TypeScript + Vite),
reached from a new title-screen button. Cute emoji items fall from the top; a free-roaming unicorn
(mouse / touch / arrows) catches them by generous overlap. No-fail, endless. One global fall speed on a
notch ladder clamped `[min, max]`: **+1 notch per 5 catches, −1 notch per 3 misses**, reset on entry
(self-balancing). Score = total catches (top-left); celebration every **25** catches. New distinct sky,
new music playlist (same SFX), new **animated** unicorn (catch-mode only, decoded from a supplied GIF).

This brief summarizes three Exa-sourced investigations (UX, architecture, tech stack) plus codebase
grounding, and consolidates the recommendations that feed the design.

---

## Axis 1 — UX (forgiving catch game for ages 3–5)

**Key findings**

- 4-year-olds have a mean touch-offset error of ~3.8 mm and low fine-motor precision; touch targets for
  under-5s should be ≥ ~2 cm and hit areas should accept out-of-bounds taps.
  ([nngroup](https://www.nngroup.com/articles/children-ux-physical-development/),
  [TIDRC framework](https://init.cise.ufl.edu/wp-content/uploads/sites/775/2019/04/TIDRC-Framework-soni-et-al-IDC19-final.pdf),
  [BBC GEL](https://www.bbc.co.uk/gel/features/games-framework))
- **Pointer-follow** (the catcher tracks the cursor/finger continuously) is far more reliable than
  click-drag for this age. ([nngroup](https://www.nngroup.com/articles/children-ux-physical-development/))
- **Free-roaming** is fine for preschoolers *only* with a dead-simple metaphor (cursor-follow, not
  self-propelled navigation). "Collecting things" is the strongest enjoyment driver and is amplified by
  full-screen roaming and an "I am the unicorn" bond.
  ([KU Leuven laddering](https://lirias.kuleuven.be/retrieve/85d83bfa-416c-4dcf-ac80-a0bb7f255fd7))
- Adaptive difficulty must be **bidirectional** and react quickly when the child struggles; one-direction
  (harder-only) ramps cause abandonment. Minimum difficulty must *always* allow success.
  ([MDPI DDA survey](https://www.mdpi.com/2813-2084/3/2/12),
  [KU Leuven adaptive reading](https://lirias.kuleuven.be/retrieve/a9d3983d-01ef-468c-8c6c-e6a9c12bcf45))
- 4–5 year olds have visual working memory of ~2–3 items and struggle to filter clutter; cap simultaneous
  on-screen items low. Variety should be **cosmetic** (different emoji), never mechanical (different rules).
  ([Springer 2025](https://link.springer.com/article/10.1007/s44436-025-00009-z),
  [Nature Kids case study](https://pdfs.semanticscholar.org/d26d/02ed8339d4bde653eb483a97408ff210fefc.pdf))
- Rewards/celebration are the highest-centrality enjoyment element, but for sensory comfort: feedback within
  ~300–500 ms, short and observable, **no screen flash, no audio spikes**, and disengageable (calm mode →
  remove particles, soften/mute audio).
  ([Pok Pok](https://play.google.com/store/apps/details?id=com.playpokpok.pokpok),
  [Kokotree sensory-friendly](https://kokotree.com/preschool-app/calm-sensory-friendly),
  [ages 3–6 UX](https://medium.com/@roviobert/ui-ux-guidelines-for-ages-3-6-68f1c9656574))

**Recommendation**

Pointer-follow movement (mouse/touch) plus arrow keys; catch hitbox radius **well larger than the visible
unicorn** and catch on any overlap. Keep free-roaming with light smoothing. Cap simultaneous falling items
to ~**3–4**; clamp `min` speed slow enough that an item is always reachable. Per-catch: short (~0.3–0.5 s)
sparkle + chime at the catch point. Milestone (every 25): 2–3 s rainbow burst + happy sound, volume-capped.
Calm mode: drop particles, soften celebration to a glow + single soft chime, no flash.

**Open questions** — desktop default (mouse vs arrows) for a 4-y-o; item size as % of viewport (playtest);
whether to rotate 2–3 celebration variants so #25 keeps novelty.

---

## Axis 2 — Architecture (keep logic pure + testable)

**Key findings**

- The reliable pattern is a **pure-logic core** (no engine import) that holds difficulty state and emits new
  state, with the scene as a thin adapter — runs headlessly in Vitest in milliseconds.
  ([black-box sim](https://samuel-bouchet.fr/posts/2026-04-08-black-box-sim/),
  [hexagonal game logic](https://shendriks.dev/posts/2024-12-30-making-game-logic-framework-independent-with-hexagonal-architecture/),
  [Tetris logic/render split](https://www.codcompass.com/en/kb/tetris-in-vanilla-js-srs-rotation-7-bag-randomizer-and-why-you-should-separate-game-logic-from-rendering-415863))
- A notch ladder = a plain integer + two counters + a `clamp(notch, min, max)`. No class hierarchy needed.
  ([codereview](https://codereview.stackexchange.com/questions/61889/increase-difficulty-based-on-score),
  [ai-director-demo](https://github.com/6ajmon/ai-director-demo))
- Movement must be **delta-time scaled** (`px += speed * dt`), never per-frame constants, or speed becomes
  hardware-dependent (120 Hz runs 2× fast).
  ([Phaser loop FAQ](https://github.com/samme/phaser3-faq/wiki/The-game-loop))
- **Spawn cadence and fall speed should be independent knobs.** Fixed spawn interval + speed-only ramp is
  simplest and safest for a no-fail kids' game; coupling them complicates tuning.
  ([gameplay guidelines](https://docs.pixelroot32.org/guide/gameplay-guidelines),
  [endless-runner pooling](https://emanueleferonato.com/2018/11/13/build-a-html5-endless-runner-with-phaser-in-a-few-lines-of-code-using-arcade-physics-and-featuring-object-pooling/))
- DDA pitfalls: oscillation/thrash, runaway escalation. Fixes: **reset both counters to 0 after each notch
  change**, move only ±1 notch at a time, hard-clamp to `[min, max]`, and make the down-step slightly more
  sensitive than the up-step (our 3 misses vs 5 catches already does this).
  ([flow/DDA](https://gamejuice.co.uk/articles/dynamic-difficulty-flow-zone),
  [difficulty scaling](https://recited.io/kb/ai-in-game-development/combat-and-decision-systems/difficulty-scaling/))

**Recommendation**

Put the speed/difficulty logic in a **pure `src/core/` module** (`{ notch, catchCount, missCount }` +
`recordCatch`, `recordMiss`, `resetForEntry`, `speedForNotch`) unit-tested with Vitest, separate from the
scene. One global fall speed read each frame; falling items move by `y += speed * dt`. Fixed spawn interval;
only speed rides the ladder. Reset counters on every notch change and on scene entry. (Note: the existing
game uses **manual dt movement, not Arcade Physics**, so we match that rather than the agent's
`setVelocityY` suggestion — same dt-correctness, no new physics system.)

**Open questions** — does a notch change retune in-flight items (simplest: yes, global speed applies to all)
or only new spawns; size of the speed table (how long to reach `max`); does the 25-catch celebration pause
spawning or play over live gameplay.

---

## Axis 3 — Tech Stack (animated GIF, background, Phaser 4)

**Key findings**

- For an animated GIF sprite, the best practice is **decode → build a sprite sheet at build time**, then
  play a Phaser animation. Among extractors (gifuct-js, gif-frames, omggif, ImageMagick), **`sharp` is the
  only actively maintained option**, handles GIF frame disposal/transparency via libvips, and extracts
  per-frame (`sharp(gif,{animated:true,page:i})`); stitch frames with `sharp.composite()` into a horizontal
  sheet. ([sharp constructor](https://sharp.pixelplumbing.com/api-constructor/),
  [sharp #2326](https://github.com/lovell/sharp/issues/2326),
  [extractor comparison](https://npm-compare.com/gif.js,gifencoder,gifsicle,gifuct-js,omggif))
- Phaser 4's animation API is **effectively unchanged from v3**: `this.load.spritesheet(...)`,
  `this.anims.create({ frames: this.anims.generateFrameNumbers(key,{start,end}), frameRate, repeat:-1 })`,
  `sprite.anims.play(...)`. Animations are **global** (register once in Boot, don't re-register per scene);
  `repeat:-1` never fires `animationcomplete`.
  ([Phaser 4 anims skill](https://cdn.jsdelivr.net/npm/phaser@4.2.0/skills/animations/SKILL.md),
  [v4 migration](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md))
- Per-scene distinct backgrounds: load the scene's own texture in its `preload()` and add it first /
  `setDepth(-1)`. Plain `this.add.image()` avoids the NPOT anti-aliasing caveat that affects `tileSprite`.
  ([scenes](https://docs.phaser.io/phaser/concepts/scenes),
  [tile-sprite NPOT](https://docs.phaser.io/phaser/concepts/gameobjects/tile-sprite))
- Confirms the project's known Phaser-4 gotchas: preFX/postFX replaced by Filters; runtime-generated
  textures (`Graphics.generateTexture` / `DynamicTexture` without `.render()`) can render blank — prefer
  real bundled assets / shape GameObjects. ([v4 migration](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md))

**Recommendation**

Add `scripts/build-catch-unicorn.mjs` (mirrors `build-atlas.mjs`) using **`sharp`** to decode the supplied
GIF into a horizontal spritesheet PNG + a small JSON sidecar (`frameCount`, `frameWidth`, `frameHeight`),
wired as `npm run` script. Load it as a spritesheet with a **distinct key** (e.g. `catchUnicorn`), register
one looping animation in Boot, play it on the catcher sprite scaled to the play area. The "different sky" is
a plain `this.add.image()` background in the new scene. Falling items reuse the existing `openmoji` atlas
frames (cosmetic variety only).

**Open questions** — validate the actual GIF's frame disposal/uniform frame size after a test extraction;
source/confirm 2–4 new royalty-free calm tracks for the catch playlist (existing tracks are real
Kevin-MacLeod MP3s; user wants *different* tracks, same SFX).

---

## Codebase grounding (resolved)

- `sharp@0.35.2` already in `devDependencies`; build scripts live in `scripts/*.mjs` with `npm run
  atlas|audio|icons` — the GIF pipeline follows this exact pattern, no new dependency.
- Scene registry: `[BootScene, TitleScene, GameScene, RainbowScene]` ([main.ts:20](../../../src/main.ts)) →
  add `CatchScene`.
- Game config has **no physics** → use manual `dt` movement + distance-overlap catch (matches
  `GameScene.updateCollectibles`).
- `RainbowScene extends GameScene`, but catch shares no shooter mechanics → **standalone `CatchScene`**.
- Existing unicorn is the `openmoji` atlas frame `"unicorn"` (sprites.ts); the animated catch unicorn is a
  separate spritesheet/animation key → no collision; the shooter is untouched.
- Reusable building blocks: `scenes/ui/Background.ts`, `scenes/ui/Celebrations.ts`, `audio/sound.ts`
  (SFX + playlist), `state/settings.ts` (calm), `TitleScene.makeButton`.

## Consolidated design inputs

1. **Standalone `CatchScene`** + a **pure `src/core/catch` difficulty module** (Vitest-tested).
2. **Pointer-follow + arrows**, free-roaming, generous overlap catch radius.
3. **Fixed spawn interval**, cap ~3–4 concurrent items; **only fall speed** rides the notch ladder
   (one global speed applied to all items each frame via `y += speed * dt`).
4. Notch ladder: +1/5 catches, −1/3 misses, reset counters on every change, reset to start notch on entry,
   clamp `[min,max]` with `min` always catchable.
5. **GIF→spritesheet via sharp** build script; animated catch-only unicorn; **distinct sky** image;
   **separate music playlist**, **same SFX**; calm-mode aware celebration every 25 (no flash/spike).
