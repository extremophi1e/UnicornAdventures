# Research Brief — Tap-to-Grow Garden (🌱 7th game mode)

**Date:** 2026-06-27
**Topic:** A no-fail "tap to grow a meadow" creation-sandbox mode for *Zoe's Rainbow Unicorn*
**Status:** Research complete — feeds the design spec.

## Context (locked from grilled intake)

A 7th mini-game for the existing Phaser 4 + TypeScript + Vite game (ages 3–5, no-fail,
experiential-not-score, tiered juice with a ceiling, huge forgiving tap targets,
reduced-motion path). Locked design decisions going into research:

- **Core loop:** tap the ground → a plant sprouts and **grows at the tapped point** with a
  sparkle. The *kind* of plant climbs a **flower → bush → tree maturity ladder** as the
  meadow fills.
- **Living things:** blooming plants **release butterflies/bees** (chance rising with
  maturity) that then **wander gently**.
- **Arc:** fill the meadow (~20–25 plants, ~1–2 min) → **big bloom celebration** → gentle
  clear to bare ground → fresh round. **Endless rounds.** No score, no fail, no shown timer.
- **Reuse:** project philosophy + infra (`Sound`, `Celebrations`, `spawnEmoji`, the animated
  Noto-emoji atlas). Adds a 7th title button (the title grid is currently a full 2×3 of 6 —
  needs a layout change).

The engine/stack is already settled by the codebase, so the three axes below target what the
codebase *can't* answer: external design conventions for this genre and best-practice
techniques for its novel mechanics.

---

## Axis 1 — UX (creation-sandbox interaction for ages 3–5)

### Key findings

- **"Build it yourself" is the satisfaction engine.** Sago Mini: *"kids are much more
  interested in cause and effect when they build something themselves… no explicit goals,
  nothing to win or lose – kids become creators and tinkerers, affecting change in the world
  with every tap."* The **visible accumulating meadow IS the reward** — validates no-score.
  [Sago Mini](https://sagomini.com/article/learning-through-play-build-real-world-skills-with-sago-mini-world/)
- **Immediacy beats realism — grow in seconds, not real-time.** Sago Mini Jinja's Garden
  (ages 3–6): *"The key to our gardening mechanic is immediacy: water the plant and seconds
  later it's fully grown,"* no words, and they deliberately avoid building up high item/
  currency counts. Keep the grow animation short.
  [Apple Developer](https://developer.apple.com/news/?id=3t6o5jec)
- **Register on touch-DOWN, single-tap only, oversize the hit area.** Sesame Workshop (50+
  touch studies): children *"tap too hard, long, or multiple times until they see evidence it
  registered — program input on touch rather than lift."* Tap is the foundational gesture;
  avoid drag/pinch/double-tap; make the active area larger than the visible art.
  [Sesame Workshop PDF](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf),
  [TIDRC](https://stirlab.org/wp-content/uploads/A-Framework-of-Touchscreen-Interaction-Design-Recommendations-for-Children-TIDRC-Characterizing-the-Gap-between-Research-Evidence-and-Design-Practice.pdf),
  [NN/g](https://www.nngroup.com/articles/children-ux-physical-development/)
- **Audio is the #1 over-stimulation risk — and this game taps constantly.** Documented fixes
  for per-tap feedback: **micro-randomize** 3–5 variants (±10 cents pitch, ±1–2 ms timing) to
  kill the "machine-gun"/"same sound over and over" effect; **soften the attack** (~10 ms
  fade-in), keep clicks short (20–60 ms), peak-limit (≤ ~−3 dBTP), avoid bright 6–10 kHz;
  **not everything needs a sound** when visual feedback is already strong; always ship a
  **mute**.
  [Lessons in audio feedback](https://medium.com/@fernando1lins/lessons-learned-in-audio-feedback-for-game-and-app-design-e4818c9b72fd),
  [UI sound design](https://sonusgearflow.com/musicproduction/designing-ui-sounds-ui-and-feedback-sounds),
  [pre-school sound](https://www.gamedeveloper.com/audio/re-imagining-the-sound-of-pre-school-games)
- **The build→climax→reset arc works when the fill pays off with a child-caused celebration
  and the reset re-opens an inviting empty canvas.** Giggle Ghosts found counting-up wasn't
  enough — they added a **"ghost party"** (lights turn on, party music) and it flipped kids to
  *arguing over who plays first*. Reset must read as **"make room for more,"** not destruction.
  [Giggle Ghosts case study](https://blog.momswithapps.com/2011/10/30/the-toddlers-role-in-game-design-case-study-on-giggle-ghosts/)
- **Preschoolers prefer visible, predictable *collecting* over problem-solving, shown
  visually not numerically.** KU Leuven laddering study of 25 preschoolers: *"collecting
  things is more important and more fun than solving problems."* The filling meadow is the
  progress display; the flower→bush→tree ladder gives qualitative escalation without numbers.
  [KU Leuven study](https://lirias.kuleuven.be/retrieve/85d83bfa-416c-4dcf-ac80-a0bb7f255fd7)
- **Ambient creatures must move slowly, predictably, bounded — randomness reads as chaos.**
  Calm nature toys advertise *"slow, trackable movement, no fast taps."* Giggle Ghosts' first
  build used random trajectories and was *"too unpredictable… not enough rules for kids to
  predict and play along"* — defined paths fixed it. Butterflies/bees = gentle, never darting,
  never startling.
  [Peekaboo Calm](https://apps.apple.com/us/app/peekaboo-calm/id6748668506),
  [Flutter: Butterfly Sanctuary](https://www.runawayplay.com/games/flutter-butterfly-sanctuary),
  [Giggle Ghosts](https://blog.momswithapps.com/2011/10/30/the-toddlers-role-in-game-design-case-study-on-giggle-ghosts/)
- **Drop straight into play; no tutorial; design for the parent in earshot too.** Pok Pok
  ships no tutorial on purpose; use a **glow/sparkle "tap here"** cue instead of text. Parent
  as second audience reinforces gentle/muteable audio.
  [Pok Pok](https://www.gamedeveloper.com/design/how-just-letting-kids-be-kids-drives-the-design-of-pok-pok-playroom)

### Recommendation

Tap-down registration, oversized invisible hit areas, single-tap only — every tap visibly
sprouts + sparkles instantly. **Tiered, ceilinged, randomized audio is the single
highest-leverage decision:** do *not* play a full sound on literally every tap — use a soft,
short, low-attack, pitch-randomized grow-chime with a voice-limit so rapid taps blend rather
than stack, and reserve richer cues for ladder-climbs and the bloom; ship a mute and keep any
ambient bed quiet/duckable. Make "filling up" legible (the meadow is the progress bar; the
ladder is the qualitative escalation). Sequence the climax as one continuous beat:
fill → **child-caused bloom** → gentle clear → fresh bare ground appears *immediately and
invitingly* (a sparkle inviting the first tap), with a small token of permanence (let a
butterfly or two linger into the new round) so it reads as continuity, not erasure.
Butterflies/bees: slow, bounded, predictable, non-startling decoration — not targets. Reduced
motion should calm the creatures and bloom burst, not just transitions.

### Open questions

1. **Does the reset read as loss?** (Highest-priority playtest item — watch her face the
   instant the meadow clears.)
2. **Audio ceiling:** at dozens of taps/min, soft-randomized-per-tap vs. only-milestone-sounds
   vs. silent-tap-visual-only — which stays delightful for child *and* parent?
3. **Is "full" earned?** Does ~20–25 plants / 1–2 min make the bloom feel deserved, or end too
   soon / drag? (Giggle Ghosts needed a *much* bigger reward than expected.)
4. **Do butterflies/bees delight or distract/scare?** Find the speed/density ceiling.
5. **Is the maturity ladder even noticed** by a 3–5-year-old, or is it dev-facing only? (If
   invisible, don't over-invest art there.)

---

## Axis 2 — Architecture (accumulating 2D sprite sandbox in Phaser)

### Key findings

- **y-sort via `setDepth(baseY)`, not per-frame whole-list sorts; split static vs. moving
  layers.** Set each object's depth to its *feet* contact point (`y + h/2 − offset`). Plants
  are static → set depth **once at spawn**; only creatures move → only they re-sort. Pocket
  City's post-mortem: split into static-lower / movers / static-upper and sort only the small
  mover set.
  [Phaser forum](https://phaser.discourse.group/t/change-depth-z-index-of-sprites-based-on-their-position/11268),
  [Pocket City](https://blog.pocketcitygame.com/cheating-at-z-depth-sprite-sorting-in-an-isometric-game/)
- **At this scale, depth sorting is free.** The stable-sort pathology only appears in the
  thousands-of-sprites range (~95 ms on 200×200 iso in 3.55, cut to ~20 ms by the fix Phaser 4
  inherits). With ~25 plants + a handful of creatures (<100 objects) it's a non-issue.
  [Phaser issue #6215](https://github.com/phaserjs/phaser/issues/6215)
- **Pool via Groups, key off `active`, reset *every* mutated prop on reuse.** Toggle
  `active`/`visible` instead of `new`/`destroy` to avoid GC stutter. `group.get(x,y)` to
  fetch-or-create, `group.killAndHide(obj)` to return. **Pitfall:** reused objects retain old
  `alpha`/`scale`/tweens — reset them and `tweens.killTweensOf(obj)` on fetch. `countActive()`
  is the "how full is the meadow" signal (killAndHide keeps the child in the group).
  [Groups wiki](https://github.com/samme/phaser3-faq/wiki/Groups),
  [Ourcade pooling](https://blog.ourcade.co/posts/2020/phaser-3-optimization-object-pool-basic/),
  [Phaser 4 Groups skill](https://cdn.jsdelivr.net/npm/phaser@4.2.0/skills/groups-and-containers/SKILL.md)
- **Prefer Group over Container for the pool.** A Group is *not* on the display list — children
  render individually and keep scene-level depth control (needed for y-sort). Container adds
  per-child matrix math and confines depth to within the container.
  [Phaser 4 Groups skill](https://cdn.jsdelivr.net/npm/phaser@4.2.0/skills/groups-and-containers/SKILL.md)
- **Gentle wander = coherent noise / retained heading, NOT per-frame random force.** Reynolds:
  fresh random force each frame *"is twitchy and produces no sustained turns."* Simplest
  organic approach: a **noise-driven wobble around an anchor** — drive a target with 1-D noise
  (or a sum of sines) seeded with a per-creature random phase, steer toward it; because the
  target wobbles around the anchor, the creature can't escape to a wall (edge-sticking solved
  by construction).
  [Reynolds](https://www.red3d.com/cwr/steer/gdc99/),
  [wander tutorial](https://code.tutsplus.com/understanding-steering-behaviors-wander--gamedev-1624t),
  [shmup idle motion](https://gamedev.stackexchange.com/questions/192781/how-to-create-the-slow-random-movement-effect-you-see-in-shmup-enemy-idles)
- **Teardown is the #1 leak risk for endless rounds.** Phaser auto-destroys game objects on
  shutdown but does **not** auto-clear scene-level `events` listeners, and loose tweens/timers
  survive. Safe teardown for both round-reset and scene exit: `tweens.killAll()` →
  `time.removeAllEvents()` → `killAndHide` all pooled sprites → `events.off(...)`. Register via
  `events.once('shutdown', …)`.
  [Scenes docs](https://docs.phaser.io/phaser/concepts/scenes),
  [scene-event leak](https://github.com/phaserjs/phaser/discussions/5908),
  [Clock](https://docs.phaser.io/api-documentation/class/time-clock)
- **Don't `scene.restart()` per round — recycle in place** with a tiny FSM. Reset round flags
  in `init()` (runs before create, avoids stale data). State: `BUILDING → FULL → CELEBRATING →
  CLEARING → BUILDING`, each `enter()` once.
  [scene management](https://generalistprogrammer.com/tutorials/phaser-scene-management-tutorial),
  [state pattern](https://blog.ourcade.co/posts/2020/state-pattern-character-movement-phaser-3/)
- **Mobile perf is dominated by draw calls — keep everything on one atlas.** 200 sprites from
  one atlas = 1 draw call vs. 50; mobile tile GPUs punish texture binds 10–30×. A single
  mid-Z additive particle or interleaved textures break the batch — keep celebration/glow FX
  on a separate top layer.
  [Phaser perf guide](https://generalistprogrammer.com/tutorials/phaser-performance-optimization-guide),
  [mobile atlas](https://ilovesprites.com/blog/unity-sprite-atlas-mobile-games)

### Recommendation

**Single `GardenScene`, recycled in place (no per-round restart).** Background at low depth;
plants + creatures y-sorted by base-Y (`depth = y`, plants set once at spawn, creatures
re-derived as they move); celebration FX on a dedicated depth ceiling with additive blend,
isolated so it never breaks the main batch. **Pools:** one Group per plant kind (`flowers`,
`bushes`, `trees`) + one `creatures` Group, pre-populated to max in `create()` then
`killAndHide`-ed; spawn resets scale/alpha/active/visible + kills stray tweens;
`countActive()` across plant pools triggers "full." **Maturity ladder:** model as a plant that
swaps its own texture to the next stage on grow-complete (fewer objects) — or pool-swap if
silhouettes pop. **Wander:** per-creature anchor + independent noise phase; target wobbles
around a slowly-drifting anchor; seed phase randomly to avoid sync. **Spawn-from-entity:** on
a plant's grow `onComplete`, pull a creature from the pool at the bloom point and start its
wander, sequenced with `time.delayedCall` + concurrent tweens (per the Timeline/chain caveat).
**Lifecycle FSM** `BUILDING → FULL → CELEBRATING → CLEARING → BUILDING`; one `teardownAll()`
(killAll tweens → removeAllEvents → killAndHide pools) used by both round-clear and the
`shutdown` handler.

### Open questions

1. **One atlas or split?** Do all plant stages + both creatures + FX fit one ≤2048² atlas
   (single batch), or is a second bind unavoidable? (Confirm against real asset sizes — likely
   already fine since the project bakes everything into emoji sheets.)
2. **Texture-swap vs. pool-swap for the ladder** — in-place frame swap is cheaper but may
   "pop" if silhouettes differ; is a brief cross-fade acceptable?
3. **Entity-owned `update()` (`runChildUpdate`) vs. centralized scene loop** for wander — which
   matches the existing codebase convention?
4. **Noise source** — tiny simplex/Perlin dep vs. zero-dep "sum of sines" (near-identical for
   gentle drift)?
5. **Worst-case frame** — ~25 plants + ~15 creatures + a full-meadow particle burst on a
   mid-range Android: does the shared particle helper cap counts / has it been profiled?

---

## Axis 3 — Technique (grow/bloom/wander within Phaser 4)

### Key findings

- **The "grow" read is in the easing.** `Back.Out` overshoots then settles (the "pop";
  tunable `overshoot`); `Elastic.Out` springs/oscillates in. Use `Back.Out` for the sprout,
  `Elastic.Out` for the final bloom flourish.
  [Back easing](https://docs.phaser.io/api-documentation/namespace/math-easing-back),
  [Elastic easing](https://docs.phaser.io/api-documentation/namespace/math-easing-elastic)
- **Tween `scale` from 0; bias `scaleY`/`scaleX` for organic non-uniform growth.** The v4
  TweenBuilder `scale` shortcut expands to `scaleX`/`scaleY`; leading `scaleY` (stem shoots)
  then `scaleX` (canopy fills), or a final `scaleX:1.1/scaleY:0.9` yoyo squash, is the
  Disney/Pixar squash-stretch juice.
  [TweenBuilder](https://docs.phaser.io/api-documentation/function/tweens),
  [squash & stretch](https://github.com/opusgamelabs/game-creator/blob/HEAD/skills/phaser/no-asset-design.md)
- **Anchor growth to the ground with `setOrigin(0.5, 1)` BEFORE scaling** so it rises from its
  base, not its middle. **Caveat:** set origin via the **`setOrigin()` method** — writing
  `originX/Y` directly does not refresh `displayOrigin`.
  [origin semantics](https://docs.phaser.io/phaser/concepts/gameobjects),
  [directional stretch](https://stackoverflow.com/questions/70802692/how-do-i-dynamically-stretch-an-image-in-phaser-3),
  [displayOrigin gotcha](https://github.com/phaserjs/phaser/issues/5469)
- **The `tweens.chain` top-level-delay bug is real and open (#7093).** *"If there is a non-zero
  delay specified in the tween chain, the tween chain will not start."* Confirms the project's
  caveat — sequence with `time.delayedCall(ms, () => tweens.add(...))` + concurrent tweens.
  [issue #7093](https://github.com/phaserjs/phaser/issues/7093)
- **Animated-emoji + grow-tween is the right call, but the *cleanest* growth read is a
  staged silhouette change.** Procedural 2D plant growth drives a single `t:0→1` that reveals
  seed→stem→leaves→bloom (silhouette changes, not just size). Emulate on-style by keeping the
  emoji but **swapping the texture/frame mid-grow** (seedling → flower via `delayedCall`),
  layered over the emoji's own ~24-frame loop — ~80% of the "it's alive and changing" read
  without leaving the art style.
  [garten](https://github.com/adewale/garten),
  [p5 growing plant](https://p5js.ai/sketchdocs/s/ai-growing-plant-seed-to-flower-journey),
  [tap-to-plant canvas toy](https://github.com/VicVisjA/juegocozydejardin)
- **Gentle butterfly/bee drift = `Curves.Path` + `PathFollower`, no Timeline.** A PathFollower
  follows a spline via an internal counter-tween; `startFollow({ duration, repeat:-1,
  yoyo:true, ease:'Sine.easeInOut', rotateToPath:true })` gives lazy looping drift with
  auto-facing (or `flipX` for facing). A spline through a few random waypoints reads as
  meandering. (This is an alternative to the Axis-2 noise-wander — see synthesis.)
  [Curves & Paths skill](https://github.com/phaserjs/phaser/blob/master/skills/curves-and-paths/SKILL.md),
  [motion paths](https://phaser.discourse.group/t/phaser-coding-tips-8-sprite-motion-paths-revisited/11485)
- **Particles in v3.60+/4:** `this.add.particles(x,y,texture,config)` returns the emitter
  directly (Manager removed); burst via `emitting:false` + `emitter.explode(n)`. Sparkle =
  short `lifespan`, `scale:{start,end:0}`, `alpha:{start:1,end:0}`, `speed`/`angle` ranges,
  optional `color`/`colorEase`. Full-screen bloom = confetti (wide `x` range, `gravityY`,
  per-particle `rotate`/`scaleX` flip keyed off `particle.lifeT` for frame-rate independence);
  the emitter is a Game Object so it can be `setDepth`-ed above everything.
  [3.60 ParticleEmitter](https://github.com/phaserjs/phaser/blob/master/changelog/3.60/ParticleEmitter.md),
  [confetti](https://phaser.discourse.group/t/confetti-effect/9943)
- **Reduced motion = "reduce, not remove."** The dividing line is **spatial displacement** —
  cut large transforms / continuous loops; keep opacity/color/in-place changes. For this toy:
  grow → fast fade-in (or small 0.9→1 scale, no `Back` overshoot); bloom → single gentle
  sparkle/static frame, no full-screen confetti; **stop/greatly slow the wandering** (the main
  vestibular risk); shorten durations ~40–60%. Detect via
  `matchMedia('(prefers-reduced-motion: reduce)')` **in JS** (CSS `@media` can't suppress
  canvas tweens) plus an in-app toggle.
  [WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html),
  [reduced-motion patterns](https://www.uiuxatlas.com/lessons/motion/prefers-reduced-motion-and-motion-accessibility/),
  [spatial-displacement rule](https://karlkoch.me/writing/on-reduced-motion)

### Recommendation

**Grow (per tap):** add the emoji at the tap point with `setScale(0).setOrigin(0.5,1)` and
`setDepth(y)`; its internal loop plays (free ambient life). One tween `scale:0→1`,
`duration≈600–800`, `ease:'Back.Out'`; optionally lead `scaleY` then `scaleX` for an organic
sprout. For a real silhouette change, `time.delayedCall(mid, () => plant.setTexture(nextStage))`
mid-grow. **Sparkle + critter:** on grow-complete, `explode(~12)` a sparkle emitter at the
bloom, then (chance-gated) release a butterfly/bee. **Wander:** see synthesis — either a single
looping `PathFollower` per critter (zero-dep, no Timeline) or the Axis-2 noise-wobble.
**Celebration:** scaled-up confetti emitter + a brief camera `flash`/`zoom`, on a depth ceiling
above everything. **Reduced motion:** one `reduceMotion` boolean from `matchMedia` OR an
in-game toggle; when true → fade-in grow (no overshoot), minimal `explode(3)`/static bloom,
**stop/slow the drift**, shorten durations; keep the in-place emoji loop (appearance, not
spatial — safe).

### Open questions

1. **Is there a seedling-stage emoji** in the baked set for the mid-grow texture swap, or only
   the final flower/tree? (Determines whether growth gets a silhouette change or is pure
   scale.)
2. **One uniform grow tween vs. staged `scaleY`/`scaleX`** — does the more-convincing staged
   version justify the extra code for a kid toy? (Quick A/B in the dev build.)
3. **PathFollower lifecycle/perf** if every plant spawns a wanderer — pool/cap them; cull
   (toggle `visible`) off-viewport?
4. **Reduced motion + the emoji's own internal loop** — keep it (in-place, technically safe) or
   freeze to one frame? (Product call.)
5. **Celebration particle budget on a low-end phone** — scale `quantity`/`maxAliveParticles`
   down on weak devices and under reduced motion?

---

## Cross-axis synthesis (decisions to settle in the spec)

The three axes agree on the shape; the spec must reconcile a few seams:

1. **Wander mechanism — PathFollower vs. noise-wobble.** Axis 3 favors a per-critter looping
   `PathFollower` (zero-dep, no Timeline, auto-facing); Axis 2 favors anchor+noise steering
   (edge-sticking solved by construction). Both are valid and gentle. **Lean PathFollower** for
   simplicity and on-style facing, unless cap/perf testing favors the lighter noise approach.
2. **Audio ceiling is the make-or-break UX call.** Because the child taps constantly, a naive
   per-tap sound is the fastest route to an overstimulated kid and a muted app. The spec must
   specify **randomized, soft, voice-limited per-tap feedback** (or milestone-only sound), not
   "play the collect SFX on every tap." This is the single highest-leverage decision.
3. **Reset must read as "make room for more," not loss.** Sequence bloom → clear → fresh-canvas
   as one continuous, child-caused beat with a token of permanence (a butterfly lingers). This
   is the top playtest risk.
4. **Maturity-ladder visual model** — in-place texture swap (cheap) vs. pool-swap (cleaner if
   silhouettes differ); depends on what emoji stages exist (Axis-3 Q1, an asset/codebase
   probe).
5. **Reuse vs. new** — `Celebrations` (popAt/bigParty/banner) and `spawnEmoji`/pooling already
   exist and cover most needs; the genuinely new code is the grow-tween-at-origin, the
   plant→creature release, the wander, and the round FSM. Keep the new surface small (the
   user's standing preference for the lean option).
