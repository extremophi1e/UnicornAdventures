# Pop the Cuties — Research Brief

Research feeding the design of a third game mode for *Zoe's Rainbow Unicorn* (Phaser 4
+ TS + Vite, no-fail, built for a 4-year-old). **Pop the Cuties** = tap-to-pop: cute
animated emoji bubble-float gently upward from the bottom with a soft sway; the child
taps to pop each into a sparkle burst + pop sound. Pinned in intake: running pop **count
+ milestone celebration every N**; float speed **self-balances** on a notch ladder (pop →
faster, escape off top → slower); **multi-touch** with a generous hit radius (each finger
pops the nearest cutie within range, multiple at once); bubble float (sine sway, varied
speeds); a rare **rainbow bonus cutie** whose pop triggers a big burst.

Three parallel Exa investigations: UX, Architecture, Tech Stack.

---

## 1. UX — toddler tap-to-pop conventions

**Key findings**
- Register input on **touch-DOWN, not release** — toddlers tap hard, long, and repeatedly until they see feedback; double-tap is not intuitive. (Sesame Workshop best-practices PDF — joanganzcooneycenter.org)
- **Generous, oversized hit areas.** Research with ages 3–6 used a ~23 mm bounding circle as the minimum "hit" threshold; frameworks recommend accepting touches up to ~10 mm outside the visual target for ages 2+. (TIDRC framework, IDC 2019, init.cise.ufl.edu; ijhcs2015 study, mintviz.usv.ro)
- **Embrace multi-touch / mashing.** Toddlers land several fingers at once; 2+ fingers should trigger the same effect as one, and the UI must never go unresponsive. A real Balloon-Pop review specifically complained that the lack of multi-finger popping frustrated the child. (Sago Sago Q&A, joanganzcooneycenter.org; UX Collective "little fingers", uxdesign.cc; Google Play Balloon Pop)
- **Juice = three channels within ~100 ms:** squash-and-stretch on the popped object (highest-value single animation), a particle burst from the contact point, and a short pop sound with **pitch randomization** (±5–10%) so repeats don't feel robotic. (jasont.co/juice-techniques; valdemird.com game-feel; gamejuice.co.uk juice-intention-matrix)
- **No-fail but not feedback-free:** always give encouraging positive feedback; a cutie that escapes un-popped should get a gentle acknowledgment (wave/smile) rather than silently vanishing. Milestone cadence ~every 25 pops reads as "an event" in comparable bubble-pop apps; ~10–15 min sessions suit 3–4 year-olds. (Google "Building for Kids"; mybabywonder.com Baby Bubble Pop; Kokotree)
- **Accessibility:** keep the background simpler than the foreground cuties; respect photosensitivity (no >3 flashes/sec over >25% of screen, avoid red flashes) for confetti/sparkles; honor `prefers-reduced-motion`; never rely on text or sound alone (most under-5s can't read and may have sound off). Layering music *over* SFX can overload under-5s. (TIDRC; Game Accessibility Guidelines; Google "Building for Kids")
- **Pitfalls:** decorative things that look tappable but aren't; accidental exit/navigation (the #1 complaint in pop-app reviews); small targets at screen edges where wrists rest.

**Recommendation:** Pop on `pointerdown` with a hit radius ≥ ~23 mm physical, processing every simultaneous finger. Layer all three juice channels on each pop (elastic squash→burst→detuned pop sound). Give escaped cuties a small float-away wave instead of silent removal. Keep the milestone celebration audio-visual, validate flashes against photosensitivity limits, and offer a reduced-motion path. The self-balancing ladder is developmentally sound — it adds gentle tension without failure.

**Open questions:** exact phone screen size (sets the pixel radius for ~23 mm); show the count as a digit or a pre-reader-friendly icon; N for the milestone (≈25 vs Catch's 10); whether to add Android haptics (`navigator.vibrate`) as an enhancement; reduced-motion = simpler burst or none; a cap on concurrent cuties for readability.

---

## 2. Architecture — spawner / tap game structure

**Key findings**
- **Object pooling via a Group subclass** is canonical: `add.group({ classType, maxSize })`, `get(x,y)` / `killAndHide()`. Wrapping it in a `CutiePool` with `spawn()`/`despawn()` keeps lifecycle off the scene. (ourcade.co; docs.phaser.io Group)
- **Do NOT use per-sprite `setInteractive` for nearest-within-radius multitouch.** Built-in pointer events fire only for the topmost object. The standard pattern: one `scene.input.on('pointerdown', pointer => …)` handler that iterates active pool children, computes `Phaser.Math.Distance.Between(...)`, and pops the nearest within radius — fires once per finger, handles simultaneous touches cleanly. (phaser.discourse.group; docs.phaser.io InputManager)
- **Multitouch needs explicit pointer registration** — Phaser creates only 1 touch pointer by default; set `input: { activePointers: 4 }` (or `input.addPointer(n)`). Each finger-down is a separate event with a unique pointer id. (rexrainbow notes; docs.phaser.io input)
- **Keep pure logic in a zero-dependency core** (spawn timing, the speed ladder, milestone counter) as plain state transforms, unit-tested without a browser — exactly the project's existing pattern. The notch ladder is a pure `adjustSpeed('pop'|'escaped')`. (suzuki-shoten.dev; emanueleferonato.com Phaser 4 headless)
- **Particle bursts:** `add.particles(x,y,tex,{emitting:false})` then `explode(count,x,y)` per pop; ~10–20 particles, destroy via `delayedCall` after lifespan, or reuse a few pre-created emitters. (docs.phaser.io particles)
- **Sine wobble** is cheap: rise y in `update()` (or a looping tween) and set `x = baseX + sin(t*freq+phase)*amp`, with per-spawn `freq/amp/phase`. (generalistprogrammer.com)
- **Lifecycle pitfalls:** on despawn call `this.tweens.killTweensOf(sprite)` before `killAndHide` (orphaned looping tweens keep running); register external listeners (`scene.input`, registry) for removal via `this.events.once('shutdown', cleanup)` — restart listener-leak is the most-reported Phaser bug. Internal `this.tweens`/`this.time` auto-clean on stop. (ourcade.co; phaser.discourse.group; generalistprogrammer.com)

**Recommendation:** Three layers — a pure `CutieCore` (ladder + milestones + spawn cadence, Vitest-tested), a `CutiePool` Group subclass owning sprites with per-cutie sway params, and a `CutieScene` wiring a single scene-level `pointerdown` (nearest-within-radius, radius scaled to device) to the pool/core. Always `killTweensOf` before recycling, and clean external listeners on shutdown.

**Open questions:** confirm Phaser 4's Group/particle API matches the 3.60+ findings against the installed version; per-frame `update()` sway vs looping tween; cutie count at which mobile perf degrades; whether mode switches need `scene.remove()`/`add()` or the existing `stop()`/`start()` suffices.

---

## 3. Tech Stack — best Phaser 4 APIs for this mechanic

**Key findings**
- **Pointers:** Phaser 4 defaults to mouse + 1 touch pointer; enable more via `input:{ activePointers:N }` or `input.addPointer(N)` (up to 10). Scene-level `pointerdown` fires once per finger with its `Pointer`. (docs.phaser.io InputManager / input concepts)
- **Circular hit areas:** `setInteractive(new Phaser.Geom.Circle(cx,cy,r), Phaser.Geom.Circle.Contains)` or `input.setHitAreaCircle(...)`; bare `setInteractive()` defaults to a *rectangle* (a common round-object pitfall). Use r larger than the visual sprite for generosity. (docs.phaser.io input; phaser.discourse.group)
- **Particles (Phaser ≥3.60, carried into 4):** `ParticleEmitterManager` removed; `add.particles(x,y,tex,{emitting:false})` → `emitter.explode(count,x,y)`. Particles are internally pooled (no GC spike); `reserve:N` pre-allocates; `COMPLETE` event when last particle dies. 2–3 shared emitters beat one-per-pop. (docs.phaser.io particles; phaser@4.2.0 particles SKILL.md; deepwiki)
- **Rendering:** Phaser 4's renderer is faster (4-vert quads, smarter multi-texture); keep sprites/sparkle frames in one power-of-two atlas to batch in a single pass; `autoMobileTextures` drops to 1 texture unit on mobile. Standard rendering handles far more sprites than this game needs — `SpriteGPULayer` is overkill (no per-sprite hit-testing). (phaser.io renderer/shader/rendering guides)
- **Audio:** WebAudio (Phaser's default) is "much better suited to lots of short SFX in quick succession." Fire-and-forget `this.sound.play('pop', { detune: Phaser.Math.Between(-100,100) })` overlaps natively and adds free pitch variety; for the HTML5 fallback, load with `{ instances: 6 }` or only one pop plays at a time. Cap concurrent instances (~4–6) so mashing doesn't saturate. (docs.phaser.io audio; WebAudioSound API; phaser@4.2.0 audio SKILL.md)
- **No extra library needed** — Phaser 4 natively covers multitouch, circular hit areas, pooled particle bursts, detuned WebAudio, atlases, and tween float.

**Recommendation:** `input:{ activePointers:4 }` + a single scene-level `pointerdown` doing manual nearest-within-radius hit-testing (radius ~1.5× sprite), avoiding per-sprite interactive churn. Use 2–3 reusable `emitting:false` particle emitters with `reserve:20`, `explode(~12)` per pop. Fire-and-forget detuned `pop` SFX (preload `{instances:6}` fallback). Reuse the existing emoji spritesheets; current sprite counts are well within budget.

**Open questions:** confirm Phaser 4 fires a separate `pointerdown` per simultaneous finger (validate on device); cost of `setInteractive` on 20–30 sprites vs manual hit-test; max concurrent emitters that matter; PWA/mobile audio-unlock timing; exact `autoMobileTextures` flag name in 4.x.

---

## Cross-cutting decisions to settle in design

1. **Hit-test approach:** scene-level `pointerdown` + manual nearest-within-radius (all three axes agree) rather than per-sprite `setInteractive`. Enable `activePointers: 4`.
2. **Pop FX:** the repo already has `Celebrations.popAt()` (8 tweened atlas sparkles). Decide: keep it (proven, simple) vs upgrade to a pooled particle emitter (better under frenzied multitouch). Add squash/stretch on the cutie either way.
3. **Pop sound overlap:** ensure `pop.mp3` plays fire-and-forget with `detune` randomization so rapid pops overlap and vary.
4. **Self-balancing speed:** reuse `src/core/catch.ts`'s notch ladder (pop = "catch", escape = "miss") or a sibling pure module; keep it Vitest-tested.
5. **Escaped cutie:** gentle float-away/wave acknowledgment, not a silent disappear.
6. **Milestone N + count display:** pick N; decide digit vs icon for a pre-reader.
7. **Music:** other modes play music; weigh the under-5 "music-over-SFX overload" finding (quieter bed, or keep consistent).
8. **Reduced motion / photosensitivity:** cap celebration flashes; consider honoring `prefers-reduced-motion`.
9. **Concurrency cap:** max cuties on screen for readability.
10. **Rainbow bonus:** define exactly what its pop does (big party; clear screen?).
