# Research Brief — 🐠 Tap the Aquarium

**Date:** 2026-06-27
**Mode:** A 6th game mode for *Zoe and Desi's Rainbow Unicorn Adventures* (Phaser 4 + TypeScript + Vite).
**Concept (from grilled intake):** A calm, **non-destructive aquarium sandbox**. No score, no fail, no HUD (just a ⬅ back button). Cute sea-creatures drift **horizontally**; tapping one triggers a **weighted-random surprise** from a **rarity-tiered catalog** (Common gentle → Uncommon showy → Rare jackpot); the creature is never destroyed. **Flowing tank** (~6–8 baseline, hard cap ~16, recycle on exit, `split`/`school` re-roll to non-additive at cap). Cast = existing 8 aquatic emoji **+ new real fish** via the build pipeline. Own shape-based `AquariumBackground`, own music + **reaction-matched SFX**. Multi-touch, reduced-motion, photosensitivity-safe.

This brief summarizes three parallel investigations (UX, Architecture, Tech Stack) run via Exa. It is authoritative input to the design spec.

---

## 1. UX — interaction patterns for toddler tap toys

### Key findings
- **Novelty genuinely delights this age, and the preference is age-graded.** Children develop a preference for *novel* causal outcomes between ages 2 and 3; 3-year-olds strongly prefer a "machine" that produces surprising new results, while 2-year-olds show no reliable preference — and the preference is for **novelty, not unpredictability per se** (it disappears when outcomes are known in advance). [cogsci paper](https://cognitivesciencesociety.org/cogsci20/papers/0567/0567.pdf)
- **Surprise ≠ variable-ratio reinforcement — only the latter is the compulsion engine.** A surprising creature appearing is *not* the same as a variable-ratio schedule that conditions repeat-checking. Deliver delightful surprise without a check-back reward loop. [game-design analysis](https://www.socratopia.app/library/game-design-en/chapter-4)
- **Persuasive/compulsion design is a documented harm in kids' apps** — constant variable-reward cycles mimic poker-machine reinforcement; younger / lower-self-regulation children are hit hardest. Avoid currencies, points, streaks, escalating rewards. [preprint](https://doi.org/10.31234/osf.io/jqg6d) · [QUT eprint](https://eprints.qut.edu.au/258323/)
- **Calm beats frantic.** Sago Mini is the calm counter-example to high-energy overstimulating design: muted palettes, slow/gentle motion, warm rounded sounds over sharp beeps, soft sparkles over explosive pops, predictable-but-varied responses. [kids UX tips](https://www.ungrammary.com/post/designing-for-kids-ux-design-tips-for-children-apps) · [satisfying vs stimulating](https://medium.com/@recordcreativeco/why-kids-apps-need-more-satisfying-and-less-stimulation-13a2a2696b03)
- **Montessori/sensory guidance:** avoid flashing/loud/reward-based/chaotic; favor slow visuals, tap-anywhere, real cause-and-effect, baby-locks, no exit buttons, no ads/menus. [Montessori screen activities](https://babyscroll.app/blog/montessori-friendly-screen-activities-for-toddlers) · [low-stim UI](https://vp0.com/blogs/low-stimulation-ui-kit-for-autism)
- **Touch ergonomics (HCI-sourced):** minimum target ~1 cm × 1 cm physical ([NN/g](https://www.nngroup.com/articles/touch-target-size/)); the children-specific **TIDRC** framework adds: enlarge the *active hit area beyond the visible sprite*, accept tap times up to ~5 s and ~10 mm offset, generous spacing, avoid flick/drag/pinch/double-tap for under-4s, and only use multi-touch for actions with **no "correct" answer**. [TIDRC framework (PDF)](https://init.cise.ufl.edu/wp-content/uploads/sites/775/2019/04/TIDRC-Framework-soni-et-al-IDC19-final.pdf)
- **Feedback expectations:** children expect *immediate* combined visual+audio response to every touch; "larger, longer visual feedback" helps; multi-touch is triggered unintentionally so must never break things. [Sesame Workshop report (PDF)](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf)
- **Reference apps / kid-mode conventions:** Toca Boca & Sago Mini = "digital toys, not games" — open-ended, no win/lose, no levels, no text/VO, no IAP, no ads. [Sago](https://kidscreen.com/2015/04/09/sago-sago-dishes-on-developing-for-the-preschool-market/) · [Toca Boca](https://www.pocketgamer.biz/childs-play-free-to-play-is-a-no-no-when-it-comes-to-apps-for-kids-says-toca-bocas-emil-ovemar/). Aquarium-specific: **RYUKIN** has a dedicated **"Cat & Baby Mode"** for safe toddler play and a gentle "tap too much and the fish faints" self-limiter (but gates fish behind IAP). [RYUKIN](https://apps.apple.com/us/app/ryukin/id6471839445). **AbyssRium / Tap Tap Fish** is the *anti-pattern* — mystery chests, lucky bubbles, subscriptions: a tap-to-grow compulsion loop to avoid. [AbyssRium](https://apps.apple.com/us/app/tap-tap-fish-abyssrium/id1068366937)

### Recommendation
- **Keep it "surprising variety, not jackpots to chase."** The weighted-rarity catalog aligns with the novelty-preference research and will delight the 4-year-old lead. **Do not** add any persistent counter, currency, collection meter, or "keep tapping to unlock" — that converts delight into a variable-ratio loop (the documented harm). Each tap is self-contained and *guaranteed* a pleasant reaction; rarity only varies *which* one.
- **Tone the Rare tier for calm + photosensitivity.** The rainbow-shockwave and "school swims in" are the highest overstimulation/seizure risk: make them genuinely rare, render the rainbow as a **slow gentle sweep** (flashes < 3/sec, low-contrast), and swap to a calmer variant under `prefers-reduced-motion`. Warm rounded sounds, never sharp stingers; cap simultaneous reactions.
- **Touch sizing:** hit radius generously larger than the sprite (visible ~1.5–2 cm + ~10 mm padded invisible hit circle), tolerate offsets, fully embrace multi-touch "mashing" (the no-correct-answer case TIDRC endorses). Respond within ~100 ms with combined visual+audio.
- **Pacing:** slow, ambient drift; the tank should be rewarding just to *watch*. Consider RYUKIN's gentle self-limiter idea (over-tapping → sleepy/dizzy wiggle rather than escalating spectacle) to damp frenzy without a "fail."
- **Guardrails:** back button only, small/cornered (consider hold-to-exit). No ads/IAP/external links/data collection/menus — the Toca/Sago trust standard.

### Open questions
- **Younger sibling (~2)** won't perceive the rarity hierarchy as "surprise" — for them the value is pure cause-and-effect. Design for the 4-year-old lead, or satisfy both?
- **"Morph into a different creature"** may confuse the youngest (consistency with real-world referents) — keep it rare or use a calmer "puff-and-return"?
- **Gentle anti-frenzy damper** (sleepy fish) — include it, or is unlimited calm tapping the cleaner promise?
- **Reduced-motion as the *default*** for a toddler audience (opt into fuller motion)?

---

## 2. Architecture — structuring a tap-react sandbox with a capped, self-multiplying population

### Key findings
- **Data-driven reaction catalogs beat switch statements.** Model every effect as a data record (`id, type, weight, tags, sub-effects`) and dispatch via a handler keyed on `type`; a switch-over-enum "is never the thing that grows." [EffectSystem](https://github.com/MacacaGames/EffectSystem) · [unity-helpers effects](https://github.com/wallstop/unity-helpers/blob/main/docs/features/effects/effects-system.md)
- **Weighted random ("loot table"):** sum weights, roll in `[1,total]`, walk cumulative ranges; weights need not sum to 100 — tiers are just larger/smaller weights (e.g. Common 70 / Uncommon 25 / Rare 5). [loot drop best practices](https://www.gamedeveloper.com/design/loot-drop-best-practices)
- **Pure weighted random clumps; a shuffle-bag draws without replacement** (every outcome appears per cycle, order varies) — good for non-critical flavor but can "ping-pong" at bag boundaries. A "dueness"/pity weight is a middle ground. [shuffle bags](https://code.tutsplus.com/shuffle-bags-making-random-feel-more-random--gamedev-1249t) · [middle ground](https://gamedev.stackexchange.com/questions/201805/looking-for-a-middle-ground-between-raw-random-and-shuffle-bags)
- **Phaser pooling = `Group`.** `group.get()` returns a dead member or creates one; **reset `active/visible/alpha/scale/angle/tint` on reuse** — the recycled instance carries stale state. [Ourcade pools](https://blog.ourcade.co/posts/2020/phaser-3-optimization-object-pool-basic/) · [phaser3-faq Groups](https://github.com/samme/phaser3-faq/wiki/Groups)
- **The classic recycle bug: stale tweens targeting a reused sprite.** Always `this.tweens.killTweensOf(target)` before recycling/destroying. [Ourcade](https://blog.ourcade.co/posts/2020/phaser-3-optimization-object-pool-basic/)
- **Particle-emitter leaks are real (Phaser 3.60+):** re-creating an emitter per spawn caused multi-second shutdown stalls. **Reuse one emitter per visual, reposition + `explode()`**, and `stop(); destroy()` on shutdown. [Phaser #6482](https://github.com/phaserjs/phaser/issues/6482)
- **Bounded self-multiplying populations** use a "Maintain Population / Max Alive" cap **plus a per-frame spawn ceiling** and recycling of off-screen agents (relocate, don't allocate). [Spawner Director](https://www.creativespore.com/docs/massive-swarm-system/spawners/director/)
- **Centralize "can I spawn?" as pure rules** returning a decision object (cap check → cooldown → weighted pick → constraints) — engine-agnostic and loggable. [spawn director](https://gamineai.com/blog/how-to-build-a-reusable-enemy-spawn-director-in-unity-6-and-godot-4-wave-curves-budgets-cooldowns)
- **Testability boundary:** keep a pure "black box" sim — commands in, events out, no framework imports, **seeded RNG, no `Date.now()`** — runs headless in ms. [Black Box Sim](https://samuel-bouchet.fr/posts/2026-04-08-black-box-sim/) · [hexagonal game logic](https://shendriks.dev/posts/2024-12-30-making-game-logic-framework-independent-with-hexagonal-architecture/)

### Recommendation
**Pure-logic modules (Vitest, no Phaser import) — mirrors `src/core/pop.ts` & `gumballs.ts`:**
- `aquarium.ts` (new `src/core/`): the reaction **catalog as data** (`{ id, tier, weight, kind: 'react' | 'split' | 'school', schoolCount? }`), plus `pickReaction(rng, { atCap })`. **Cap enforcement lives here:** when `atCap`, filter additive kinds (`split`/`school`) out *before* weighting so the re-roll is guaranteed non-additive. Inject `rng` (seeded) for deterministic tests. Optionally a shuffle-bag / no-immediate-repeat helper (reuse the `createBag` idea from `gumballs.ts`).
- Population accounting can be a few pure helpers (`canAdd`, `netAdds(reaction, remaining)`) or folded into the scene if trivial — keep the *decision* pure, the sprites in the scene.

**Scene layer (`AquariumScene.ts`, not unit-tested) — mirrors `PopScene.ts`:**
- One `Phaser.Group` pool of fish sprites; a small set of **reusable** particle emitters keyed by visual (reposition + `explode()`, never re-create per tap).
- On tap (reuse `pickNearestWithinRadius` from `pop.ts` for multi-touch): `pickReaction(...)` → apply visual + pool mutation. **Before recycling any fish** (drift-off or reuse): `killTweensOf(sprite)` + clear stored timers/tweens (the `clearRainbow`-style pattern already in `PopScene`).
- Drift recycle off-screen → `killAndHide` back to pool. Scene `shutdown`: stop/destroy emitters, `killTweensOf` all, stop music.

This keeps selection + cap logic fully headless-testable; the scene is a thin adapter from decisions to tweens/particles.

### Open questions
- **Shuffle-bag vs raw-weighted** for reactions — a bag guarantees the jackpot appears each cycle (predictable) vs true surprise with drought risk. Worth the extra code for a toddler toy?
- **Cap-collision UX:** silent re-roll (planned) vs a distinct "tank is full" reaction; filtering before weighting slightly distorts tier odds near the cap.
- **RNG seam:** scene owns one shared seeded generator handed to logic, vs logic owning its own.

---

## 3. Tech Stack — best Phaser 4 techniques + loop-safe fish assets

### Key findings
- **Phaser 4.0.0 (2026-04-10)** is a renderer rewrite; for standard Sprites/Text/tweens/particles it's transparently compatible — most game code needs no change. [v4.0.0 release](https://github.com/phaserjs/phaser/releases/tag/v4.0.0) · [migration overview](https://phaser.io/news/2026/04/migrating-from-phaser-3-to-phaser-4-what-you-need-to-know)
- **Tint API changed (will break code):** `setTintFill()` removed → `setTint().setTintMode(Phaser.TintModes.FILL)`. Plain `setTint(0xRRGGBB)` still works for color-flash. FX/Masks unified into a new **filter system**. [migration guide](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md)
- **The old Tween Timeline is already gone** (removed in 3.60, "replaced by the ability to chain tweens"). What remains in v4: `this.tweens.chain({tweens:[...]})` (one at a time, in order) and a separate scene-level `this.add.timeline([...])` event sequencer. [forum](https://phaser.discourse.group/t/this-tweens-timeline/13212) · [time concepts](https://docs.phaser.io/phaser/concepts/time)
- **The delay quirk, confirmed:** scene `add.timeline` events run by *time coordinate*, **ignore tween `duration`** for sequencing, and default to `at:0` (fire immediately) if no `at`/`from`/`in`. A chain's top-level `delay` applies before the whole chain. → Don't use `add.timeline` for duration-driven sequences. [forum](https://phaser.discourse.group/t/chaining-tweens-using-this-add-timeline/15325)
- **Particles unchanged in spirit:** `this.add.particles(x,y,texture,{...})`; `explode(count,x,y)` for a one-shot puff (`frequency:-1`), `flow()`/`frequency>=0` for a stream, `stop()` to end. `tint` as an array interpolates over lifespan. [particles docs](https://docs.phaser.io/phaser/concepts/gameobjects/particles)
- **Camera flash is built in:** `this.cameras.main.flash(duration, r, g, b)` flashes the whole viewport — ideal for the rainbow-shockwave screen pulse. A true ripple needs the optional rexRainbow `shockwave` **filter** (WebGL-only). [flash docs](https://docs.phaser.io/api-documentation/class/cameras-scene2d-effects-flash) · [rex shockwave](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/shader-shockwave/)
- **Noto animated sea creatures — verified against the live API (`api.json`):**
  - **PRESENT:** 🐟 fish `1f41f`, 🐡 blowfish `1f421`, 🦈 shark `1f988`, 🐙 octopus `1f419`, 🐳 spouting whale `1f433`, 🦀 crab `1f980`, 🦞 lobster `1f99e`, 🐢 turtle `1f422`, 🦭 seal `1f9ad`, 🐧 penguin `1f427`, 🦦 otter `1f9a6`, 🪼 jellyfish `1fabc`, 🐌 snail `1f40c`, 🐸 frog `1f438`, 🐬 dolphin `1f42c`.
  - **MISSING (404 in animated set):** 🐠 tropical-fish `1f420`, 🦐 shrimp `1f990`, 🦑 squid `1f991`.
  - [api.json](https://googlefonts.github.io/noto-emoji-animation/data/api.json) · [browser](https://googlefonts.github.io/noto-emoji-animation/)
- **Asset URL pattern works (HEAD-verified 200):** `https://fonts.gstatic.com/s/e/notoemoji/latest/{codepoint}/512.webp` (also `/512.gif`, `/lottie.json`). This is exactly the pipeline `scripts/build-emoji.mjs` already uses.
- **Fallbacks & licenses:** OpenMoji 17.0 = **CC BY-SA 4.0**, static only (not pre-animated). MS `fluentui-emoji-animated` = **MIT** but APNG + ~5 GB Git-LFS. (Third-party "Animated Fluent" repos have disputed licensing — avoid.) [OpenMoji](https://github.com/hfg-gmuend/openmoji) · [Fluent animated](https://github.com/microsoft/fluentui-emoji-animated)

### Recommendation
- **Stay lean — zero new npm deps.** Everything except a literal ripple is core Phaser 4; use built-in `camera.flash` for the shockwave, not the rex filter.
- **Sequencing:** prefer `tween.onComplete` chaining or `this.tweens.chain({tweens:[...]})` for per-creature steps; use **`this.time.delayedCall(ms, cb)`** to stagger the screen-wide shockwave across creatures. **Avoid `this.add.timeline`** for duration-driven sequences. (Matches the repo's existing "no Timeline / delayedCall + concurrent tweens" rule from Gumballs.)
- **Per-effect:** SPIN = tween `angle: '+=360'`. WIGGLE = tween `angle` yoyo ±15°. SQUASH/grow = tween `scaleX/scaleY` yoyo. COLOR-FLASH = `setTint()` → `clearTint()` on complete, or `addCounter` + `Color.Interpolate` for a rainbow cycle (the `PopScene` bonus pattern). BUBBLE = reused particle emitter, `explode(n)` puff or `flow` stream, `alpha 1→0`, upward speed. ZOOM-burst = tween `x/y` + `scale`. MORPH = `sprite.play('otherAnim')` / `setTexture` behind a quick scale-down/up. SPLIT = spawn a second pooled sprite at the same x/y, tween the two apart. SHOCKWAVE = `cameras.main.flash(...)` (or a tweened full-screen rainbow rectangle alpha) + staggered `delayedCall` reactions on every creature.
- **Assets:** pull the present Noto animated sea creatures via the existing `build-emoji.mjs` pipeline (`…/{codepoint}/512.*`). **Recommended new fish set:** 🐟 fish, 🐡 blowfish, 🦈 shark, 🐙 octopus, 🐳 whale, 🐬 dolphin, 🦦 otter, 🪼 jellyfish (plus the 8 already in the set). For the gaps, **recolor 🐟 fish** to fake a tropical fish rather than chase a missing asset.
- **Loop-safety probe (mandatory):** the repo's opacity probe already exists — render each chosen sheet once and compare first/mid/last opaque-pixel %. **Dolphin `1f42c` is the prime suspect** for fading mid-loop; drop or trim any that don't loop cleanly.

### Open questions
- Could not find an authoritative ticket *confirming* the dolphin mid-loop fade — treat as known-risk to verify by eye, consistent with the repo's prior notes.
- Render Noto WebP/Lottie at runtime vs pre-bake grid spritesheets (the existing pipeline) — frame-count/timing extraction not covered here (the repo already solves this).
- rexRainbow shockwave filter's exact Phaser 4 compatibility is unverified (WebGL-only); built-in `camera.flash` is the safe lean choice.

---

## Cross-cutting takeaways for the spec
1. **Surprise, not Skinner box.** No counter/currency/collection — guaranteed delight per tap, rarity only varies *which* reaction. This is both the UX-research finding and what keeps it a calm sandbox distinct from Pop the Cuties.
2. **Cap logic belongs in pure code** (`src/core/aquarium.ts`): filter additive kinds at cap *before* weighting; seeded RNG; Vitest-tested like `pop.ts`/`gumballs.ts`.
3. **Scene mirrors `PopScene`**: Group pool, reused emitters, `pickNearestWithinRadius` multi-touch, `killTweensOf` before recycle, music stopped on shutdown.
4. **Phaser 4 specifics:** no `setTintFill`; no Timeline (use `delayedCall` + chained/concurrent tweens); `camera.flash` for the shockwave.
5. **Assets:** add the *present* Noto animated sea creatures (fish/blowfish/shark/octopus/whale/dolphin?/otter/jellyfish) via the existing pipeline + opacity probe; tropical-fish/shrimp/squid are unavailable — recolor fish instead.
6. **Toddler-safety:** photosensitivity-safe rainbow (slow, <3/sec, low-contrast), `prefers-reduced-motion` path, generous padded hit radius, immediate visual+audio feedback, back-button-only.
