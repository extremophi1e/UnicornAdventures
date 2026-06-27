# Unicorn Gumballs (Surprise Machine) — Research Brief

Research feeding the design of a fourth game mode for *Zoe and Desi's Rainbow Unicorn
Adventures* (Phaser 4 + TS + Vite, no-fail, for two young kids). **Unicorn Gumballs** = a
surprise machine: one giant button → tap → the machine rattles + lights flash (a short
anticipation build-up) → a random cute thing tumbles out of a chute → fanfare + confetti.
Pinned in intake: **pure sandbox** (no score/count/collection — endless "what comes next?");
random cutie from the 11-emoji set with **no immediate repeat**; a **rare jackpot** (unicorn/
rainbow) tumbles out with an **extra-big party**; the button is **locked during the ~1s reveal**,
then re-enables. Deliberately lean ("almost no logic — a shuffle and a reveal animation").

Three parallel Exa investigations: UX, Architecture, Tech Stack.

---

## 1. UX — tap-to-surprise for toddlers

**Key findings**
- The **"what comes next?" variable-reward drive is developmentally peak at ages 3–5** — a CogSci study found 3–5-year-olds strongly prefer variable over predictable machines, driven by novelty-seeking; exploration itself *is* the reward, so a pure no-score sandbox is psychologically complete. (cognitivesciencesociety.org/cogsci20/papers/0567/0567.pdf; news.osu.edu/young-children-would-rather-explore-than-get-rewards/)
- Intermittent-reward surprise is what makes blind-box toys compelling **and** ethically fraught — the hazards are paid pulls, collection pressure, and scarcity. A **no-purchase, no-collection sandbox keeps the joy and removes all three**. (neurosciencenews.com/blind-bag-child-gambling-15348/)
- **Anticipation should be short and marked** — a "Ready… Steady… Go!" 1–1.5s build with a deliberate pause is the toddler sweet spot; beyond ~2s attention collapses. Add a brief visual "breath" between beats (rattle → pause → reveal). (bbc.co.uk/tiny-happy-people/articles/zdfvscw)
- **Giant button:** ≥2cm target for under-5s (easily met); register on **touch-down, not lift** (kids re-tap if nothing happens); squash to ~0.92 then spring back + an immediate click SFX. (medium.com/design-bootcamp/design-considerations-for-kids-48ec9bf2b18; Sesame Workshop touch guide)
- **Jackpot should be structurally different, not just bigger** — distinct sting + screen-wide slow glow + confetti, so it reads as a categorical surprise ("Easter Egg" principle); if it fires too often it stops feeling special. Suggested ~**1-in-15 to 1-in-20**. (yukaichou.com reward-design guide)
- **Photosensitivity (important):** WCAG 2.3.1/2.3.2 — no more than **3 flashes/second** over any sizable area; **saturated red is extra-hazardous**; Epilepsy Foundation flags 5–30 Hz. Safe implementation: cap the "lights flash" at **≤2 cycles/sec**, avoid saturated red, keep flash area small. Respect **`prefers-reduced-motion`**. (w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html; developer.mozilla.org seizure-disorders)
- **The locked button must keep animating** (wiggle/pulse), never freeze/gray-out — a pre-reader reads stillness as "broken." No text anywhere; all feedback visual + audio, sound-optional. Target the calm-but-exciting register of Sago Mini, not Cocomelon overstimulation. (Sesame Workshop; nngroup progress indicators; kidsindustries.com 11 principles)

**Recommendation:** Keep the rattle/anticipation ~1–1.5s in two beats (rattle, then lights-bloom), register the tap on pointer-down with a squash + click, and keep the button visibly wiggling during the lockout so it never reads as broken. Make the jackpot categorically different (distinct sting + slow screen glow + big confetti), ~1-in-15–20. Cap flashes at ≤2/sec, no saturated red, small area; behind `prefers-reduced-motion` replace shake/flash with a gentle glow-pulse while still playing the reveal + fanfare (keep at least some confetti — it's the emotional payoff).

**Open questions:** exact rattle duration to playtest; whether the idle button should bob to re-invite taps; reduced-motion = fewer confetti vs none; parent mute toggle; exact jackpot rate.

---

## 2. Architecture — reveal state machine + shuffle

**Key findings**
- A tiny **state machine** (`IDLE → RATTLE → REVEAL → SETTLE → IDLE`) with a `get isBusy()` (true for any non-IDLE) is enough; the button handler early-returns when busy — trivially testable without Phaser. (ourcade.co state-machine post)
- **Shuffle-bag** is the standard for "feels fair" no-repeat: Fisher–Yates a list of item ids, `shift()` one per tap, refill when empty → never 3-in-a-row, bounded droughts. Beats reroll-on-repeat and weighted-pick. Seed the **jackpot as slots in the bag** (e.g. 1 jackpot among ~18 entries) rather than a separate probability check. (code.tutsplus.com shuffle-bags; dev.to tetris-bag-randomizer)
- Make the pick a **pure function with injected RNG** — `createBag(rng: () => number): { next(): ItemId }` — inject `Math.random` in the scene, a stub in Vitest. Keep pick + state pure in `core/`; tweens/pool/Celebrations stay scene-side. (stackoverflow injectable-rng; space-tycoon core/scenes split)
- **Object pool of 1** for the revealed item (only one visible at a time): `group.get()` / reset `active/visible/alpha/scale/texture` on reuse. (ourcade.co pooling)
- **Lifecycle pitfalls:** looping rattle tweens (`repeat:-1`) are NOT auto-cleaned on target destroy — `stop()`/`remove()` them in the RATTLE→REVEAL transition; on scene shutdown/restart, stop any in-flight sequence + `killTweensOf` the revealed sprite, and make sure the busy-lock can't get stuck (always clear it in the final step). (phaser.discourse tween good-practices; github phaser #6539)

**Recommendation:** Three layers — a pure `core/gumballs.ts` holding `createBag(rng)` (shuffle-bag, no-immediate-repeat, jackpot seeded) and the tiny phase/`isBusy` state, both Vitest-tested; a `GumballScene` owning the machine graphic, the one-item pool, the timed reveal, and the Celebrations/Sound calls; the button reads `isBusy` and early-returns. Stop all tweens/timers and clear the busy flag on shutdown.

**Open questions:** hard min-gap between jackpots vs accepting a bag-seam pair; revealed object a `Sprite` (pool-friendly) vs `Container`; interruptible rattle on tab-background.

---

## 3. Tech Stack — Phaser 4 effects (committed stack)

**Key findings**
- **Sequencing:** Phaser 4 **removed `Timeline`** and `tweens.chain` has a known top-level-`delay` bug (issue #7093). Use **`this.time.delayedCall` + individual/concurrent tweens** — simplest, bug-free, and supports concurrent effects (rattle + lights together). (docs.phaser.io tweenchain; github phaserjs/phaser#7093)
- **Rattle one object** (not the screen): a yoyo tween on `x`/`angle` (`x:'+=8'`, `Sine.easeInOut`, `yoyo:true`, `repeat:5`, `duration:60`). `cameras.main.shake` moves only the viewport, not objects — wrong tool here. (docs.phaser.io camera shake; tweens)
- **Flashing lights (photosensitivity-safe):** alternate `setTint` on/off via `this.time.addEvent({ delay:500, repeat:N })` (~2/sec) using Phaser 4's `TintModes.FILL`; or `tweens.addCounter` for a smooth glow interpolation. Avoid fast continuous strobing. (phaser.discourse timed-blinking; docs.phaser.io tintmodes; phaser@4.2.0 tweens SKILL.md)
- **Tumble-out reveal:** `Bounce.easeOut` (rubbery landing) on a `y` drop and/or `Back.easeOut` (overshoot snap) on `scale` 0→1 — both native Phaser 4, no library. (docs.phaser.io easing Back/Bounce)
- **Giant button:** `setInteractive(new Phaser.Geom.Rectangle(...), Rectangle.Contains)` for a generous hit area (independent of display size); squash tween on `pointerdown`; debounce with the busy flag. (docs.phaser.io input)
- **Reuse, no new library:** the existing pooled confetti emitter (`emitter.explode(count,x,y)`) and `this.sound.play("fanfare"/"tada")` both work as-is across scenes. (docs.phaser.io particles; WebAudioSoundManager)

**Recommendation:** Drive the sequence with `delayedCall` + concurrent tweens (not Timeline/chain): tap → `busy=true` + button squash → rattle the machine (yoyo x tween) while flashing lights via a ≤2/sec `time.addEvent` tint toggle → `delayedCall(~900ms)` → reveal the pooled item with a `Bounce.easeOut` drop + `Back.easeOut` scale pop → on the reveal tween's `onComplete`, `emitter.explode(...)` + `sound.play("fanfare")` + `busy=false`. Everything reuses existing Phaser 4 APIs; no new dependency.

**Open questions:** machine as a single sprite vs Container (rattle targets its `x` either way); lights as separate bulb shapes vs one glow overlay; reposition the confetti emitter to the chute exit; `Bounce` vs `Back` for the reveal (quick A/B).

---

## Cross-cutting decisions to settle in design

1. **Sequencing:** `this.time.delayedCall` + concurrent tweens — **not** Phaser `Timeline` (removed in 4.x) or `tweens.chain` (top-level-delay bug). (Resolves the architecture↔tech conflict in favor of the Phaser-4-verified approach.)
2. **Pure logic = `core/gumballs.ts`:** shuffle-bag `next()` with no-immediate-repeat + jackpot seeded in the bag, RNG injected, Vitest-tested. This is the "shuffle" the pitch means.
3. **Photosensitivity:** lights flash ≤2/sec, no saturated red, small area; honor `prefers-reduced-motion` (glow-pulse instead of shake/flash; reduced—not zero—confetti).
4. **Giant button:** pointer-down trigger + squash; generous rectangle hit area; keep it wiggling while locked (never freeze).
5. **Jackpot:** ~1-in-15–20, categorically distinct (bigger party + distinct sting + slow glow), reusing `bigParty`.
6. **Reveal:** pooled single item, `Bounce`/`Back` ease; reuse `bigParty` + `fanfare`/`tada`.
7. **Anticipation:** ~1–1.5s, two beats.
8. **Lifecycle:** stop tweens/timers + clear busy on shutdown; pool of 1.
9. **Background / title button / music:** decide in design (likely reuse a cheerful background + 4th title button; SFX-led with optional quiet music).
10. **Machine art:** shape-based (Graphics), consistent with the project's other backgrounds; a giant button + a chute the item tumbles from.
