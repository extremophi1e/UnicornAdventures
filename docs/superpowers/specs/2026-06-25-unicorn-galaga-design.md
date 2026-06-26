# Design Spec — Zoe's Rainbow Unicorn

**Date:** 2026-06-25
**Author:** (grilled brainstorm with Claude)
**Research brief:** [2026-06-25-unicorn-galaga-brief.md](../research/2026-06-25-unicorn-galaga-brief.md)
**Status:** Approved design → ready for implementation planning.

---

## 1. Vision

A gentle, no-fail Galaga-style arcade game made for **Zoe (age 4)** by her dad. She flies a
**pink winged unicorn** that auto-fires rainbow stars at a parade of cute things (clouds,
cupcakes, lollipops…), clearing formation after formation, celebrating at every milestone, and
working up to friendly boss fights and a grand finale — then an endless **rainbow mode** for
open-ended play. It runs in the browser on dad's **PC** and Zoe's **phone**, installs to the
home screen, and is built so the emoji art can be upgraded to custom art later.

The emotional target: **she essentially always succeeds, nothing ever stings, and every step
feels like a real accomplishment.**

## 2. Goals & success criteria

This is the definition of done for v1 (from intake, all confirmed):

1. **Starts in seconds, no reading** — big icon buttons, autofire; she just points the unicorn.
2. **She makes real progress mostly on her own** at age 4 (generous hitboxes + aim assist).
3. **She feels accomplished** — formation clears, level clears, boss milestones, grand finale.
4. **Zero tears** — no-fail, nothing scary, no dead-ends or stuck states.
5. **Works smoothly on PC and phone** — responsive portrait, fullscreen, touch + mouse + keyboard.
6. **Extensible** — clean code, emoji art swappable to custom art, endless mode shares the level
   engine.

**Rainbow mode (endless) is in v1 scope**, not a fast-follow.

## 3. Non-goals (YAGNI)

- No numeric score, points, stars-as-currency, or high-score tables (4-year-olds don't grok
  scoring; experiential rewards work better — see brief, UX axis).
- No accounts, login, cloud sync, analytics, ads, or in-app purchases.
- No saving/persistence of any kind (she always starts at level 1; rainbow mode is always
  available — see §6.1).
- No parental gate (nothing harmful to gate: no links, purchases, or data).
- No per-shot fire sound (autofire would make it a racket / overstimulating).
- No enemy attacks that can hurt the player (it is strictly no-fail).
- No multiplayer, no level editor, no difficulty settings beyond the calm-mode toggle.
- No voice clips (music + SFX only).

## 4. Target platforms & constraints

- **Devices:** dad's Windows PC (keyboard + mouse) and Zoe's phone (touch). Cross-OS.
- **Form factor:** **portrait-primary** (vertical shooter); adapts to a wide PC screen without
  black bars (see §9 responsive).
- **Delivery:** web app served as an installable **PWA** (home-screen icon, fullscreen).
- **Privacy/legal:** zero data collected; satisfies COPPA / UK AADC / CA CAADC by construction.

## 5. Player experience & flow

```
Title  ──Play──────►  Story (Levels 1–12)  ──finale──►  Rainbow Mode (endless)
  │                                                          ▲
  └──Rainbow Mode────────────────────────────────────────────┘
```

- **Title screen:** "✨ Zoe's Rainbow Unicorn ✨", the pink unicorn bouncing gently, two large
  buttons — **Play** and **Rainbow Mode** — plus a small **calm-mode toggle** in a top corner.
  Any tap / click / key on Play starts. No reading required.
- **Play (story):** always starts at **Level 1**. Levels flow one into the next with
  celebrations between.
- **Rainbow Mode:** jumps straight to endless play (always available; also the natural climax
  after finishing the story).
- **Controls placement:** all UI/controls kept **off the bottom edge** (resting wrists bump
  bottom-edge buttons — brief, UX pitfalls).

## 6. Core gameplay loop & mechanics

### 6.1 The loop (per level)

1. Unicorn sits near the bottom; Zoe moves it by **drag / pointer / arrow keys**; it **auto-fires
   rainbow stars upward** continuously.
2. A **formation** of cute things flies in up top and **drifts/sways (no diving)**.
3. Stars pop them into sparkles. When a formation is cleared:
   - if it's **not the last** formation of the level → quick "here comes more!" beat → next
     formation flies in;
   - if it's **the last** → **level complete** → medium celebration → next level.
4. **No-fail:** an enemy touching the unicorn causes a **harmless bounce + sparkle**, never a
   penalty, life loss, or game-over.

### 6.2 Controls (one model, all devices)

- **Follow-the-pointer:** the unicorn smoothly glides toward the finger/mouse position. **Arrow
  keys** drive the same movement on the PC. Movement is mostly horizontal with limited vertical
  room near the bottom.
- **Autofire** always on; no fire button.
- **Aim assist:** generously oversized enemy hitboxes **+ light bullet-magnetism** (stars curve
  gently toward the nearest cute thing) so a 4-year-old's imprecise aim still lands. This is the
  primary "feels good for little kids" lever.

### 6.3 Rewards

- **No numbers/score.** The **tiered celebrations are the reward** (§8.3). Rewards are framed
  experientially ("look what YOU did!"), not transactionally.

## 7. Content

### 7.1 Levels & formations

- **12 levels** in the story arc.
- **Each level = an ordered list of 1–3 formations**, cleared **sequentially** (next appears only
  after the current is cleared). Formation count ramps with level (early = 1, later = up to 3).
- **Each level uses 1–3 cute types**, always placed in **coherent, authored formations — never
  randomly scattered.** "Coherent" means, e.g.:
  - a tidy block of a single type;
  - types grouped by **row** (a row of stars above a row of lollipops) or in **clusters**;
  - simple recognizable **shapes** made of a type (a heart made of hearts, an arch of stars).
- **Difficulty never comes from danger** (it's no-fail). It comes only from *more to clear* and
  *slightly livelier drift* — the experience stays calm.

### 7.2 Enemies (cute things)

- Drawn from a friendly emoji lineup, e.g. ☁️ cloud, 🧁 cupcake, ⭐ star, 🍭 lollipop, 🍦
  ice-cream, 🎈 balloon, 💖 heart, 🌸 flower, 🍩 donut, 🦋 butterfly (final lineup per level
  chosen during content authoring).
- All non-scary; burst into sparkles + a puff of color when hit.

### 7.3 Bosses

- **Levels 5, 10, and 12 (final)** are boss levels.
- A boss = a **giant version of a cute thing** (e.g. a giant cupcake) with a visible
  **"happiness meter"** (HP bar), **2 gentle, telegraphed phases** (it wiggles, changes color),
  and **no attacks that hurt** the unicorn. Zoe "tickles" it with rainbow stars until it bursts
  into the big party.
- The **level-12 finale** is the grandest celebration in the game.
- Bosses run on a small internal state machine (Entering → Idle/Move → PhaseTransition →
  Defeated); HP thresholds drive phase changes.

### 7.4 Rainbow mode (endless)

- Same engine and **same level/formation data format**, generated **procedurally**: pick coherent
  formation templates + assign 1–3 types, scaled by a gentle difficulty **budget** that grows
  with depth (more/mixed cute things, **new color palettes** for freshness). Difficulty grows by
  **count/variety, not HP inflation**.
- No bosses required, no end; periodic small rainbow bursts; play itself is the reward. She/dad
  can stop any time.

## 8. Visuals & audio

### 8.1 Art

- **Bundled OpenMoji sprite atlas** (PNG/WebP), **not** system-font emoji — guarantees identical
  art on the Windows PC and the phone, and sidesteps font-format issues. (Private family game →
  **no on-screen credits line**; can add one only if it ever ships publicly.)
- **Unicorn (player):** the 🦄 glyph from the atlas, **tinted pink**, with simple drawn **wings**
  (cheap shape accents, so it reads as the winged alicorn from the design) and a **sparkle
  trail**. Reads instantly as Zoe's pink unicorn; swappable to custom art later.
- **Projectiles:** small **rainbow-colored star** shapes from the horn.
- **Background:** gentle **animated rainbow sky** (soft gradient + a few drifting clouds) that
  fills any extra width on the PC.
- **Calm-mode button:** small friendly icon in a top corner.

### 8.2 Audio

- **Cheerful, gentle looping music**, royalty-free, **Kenney (CC0)** first (Pixabay backup).
- **SFX:** satisfying **pop + sparkle on every hit**, **fanfare on formation/level clears**, **big
  ta-da on bosses & finale**.
- **No per-shot fire sound.**
- Audio **unlocks on the first tap** (Start button); **conservative default volume**.

### 8.3 Celebration tiers (juice with a ceiling)

The research is explicit that overstimulation (especially audio) is the main failure mode, so
celebrations are **tiered** and the biggest spectacle is reserved for the rarest events:

| Event | Celebration |
|---|---|
| Each enemy pop | sparkle + soft chime (small) |
| Formation cleared (not last) | quick "more!" beat + next formation flies in |
| Level cleared (last formation) | rainbow burst + fanfare (medium) |
| Boss defeated (L5/L10) & **grand finale (L12)** | full screen-filling party + big ta-da (big, rare) |

- **Calm mode** (small on-screen toggle, default OFF = full juicy) dials back particles, screen
  effects, and SFX density for tired/overstimulated days.

## 9. Architecture

Built on **Phaser 4**, applying the research principles on top of Phaser's scaffolding.

- **Scenes as the state machine:** `Boot/Preload` (load atlas + audio, unlock sound) → `Title` →
  `Game` (story, levels 1–12) and `RainbowMode` (endless), with a parallel **HUD/overlay** layer
  for celebrations. Each scene cleans up on exit (stop music, drop listeners). Boss phases use a
  small FSM inside the Game scene.
- **Loop & timing:** Phaser's delta-timed loop; **all motion in per-second units** so behavior is
  identical on a 60 Hz PC and a 120 Hz phone.
- **Object pooling:** reusable pools (Phaser Groups) for **rainbow stars, enemies, particles, and
  celebration bits** — pre-created and recycled, targeting **zero allocation during a wave** to
  avoid GC stutter on the phone. The singleton unicorn and bosses are not pooled.
- **Data-driven levels (core):** a **level = ordered list of formations**; a **formation = layout
  template (positions) + type assignment**. Levels 1–12 authored as plain data. **Rainbow mode
  reuses the same format** via a procedural generator (templates + budget). One `WaveSpawner`
  consumes both, so authored and endless content cannot drift apart. Enemy pool sized to the
  largest single formation.
- **Collision:** brute-force **circle overlap with layer pruning** (stars→enemies;
  unicorn↔enemies = bounce). No spatial partitioning (overkill at one screen of ~100–200
  objects). Generous hitboxes + bullet-magnetism live here.
- **Art seam:** entities reference **logical sprite keys** resolved through one asset map → the
  OpenMoji atlas today, custom sprites later. Swapping art touches one file; game logic never
  references raw textures.
- **Responsive:** fixed **portrait logical resolution (~720×1280)** via Phaser's Scale Manager
  (fit + center, DPR-aware). **Aspect-aware formation layout**: the spawner reads available width
  and adds columns on wide (PC) screens so the playfield uses the space; decorative sky fills any
  remaining margin. Recompute on resize/orientation change.
- **Input:** a single unified **"aim" value** — pointer (touch/mouse) position *or* arrow keys →
  unicorn target position, **polled each tick** (device-agnostic logic). A simple autofire timer
  streams stars.
- **No storage layer** (no saving) — simplifies architecture and matches "always start at level
  1."

## 10. Tech stack & delivery

- **Toolchain:** **Phaser 4 + TypeScript + Vite** (Phaser's official "Create Game App," minimal
  template). Fast dev server + hot reload + type safety.
- **Audio:** Phaser's built-in Web Audio sound manager (no extra audio library); unlock on first
  tap. Assets from **Kenney (CC0)**.
- **Art pipeline:** chosen **OpenMoji** glyphs pre-rendered into a bundled **PNG/WebP sprite
  atlas**, loaded like any sprite sheet.
- **PWA / fullscreen:** **vite-plugin-pwa** (`registerType: 'autoUpdate'`, maskable icon,
  `display: standalone`). On **PC/Android** also request the Fullscreen API on a tap. On
  **iPhone**, standalone is the OS maximum and there's no auto-install prompt → show a **one-time
  "Add to Home Screen" hint** on iOS.
- **Hosting:** **Netlify** (dad's account) → `zoes-rainbow-unicorn.netlify.app` (custom domain
  optional later).
- **Privacy:** zero data — no accounts, analytics, ads, purchases; nothing saved.
- **One-time phone setup (documented for dad):** Add to Home Screen for the fullscreen icon, and
  enable **iOS Guided Access / Android Screen Pinning** — the real lock against accidental exits
  (web alone can't fully prevent exits).
- **Testing:** verify on a **real phone** (touch + high refresh) for feel and smoothness, not
  just desktop.

## 11. Open questions (to resolve in implementation / playtest)

These are intentionally deferred; none block planning:

1. **Boss resistance duration** — how many seconds of "tickling" before a boss bursts before a
   4-year-old reads it as "stuck"? Tune by playtest (patience cliff is short).
2. **Calm-mode effect levels** — exact particle/SFX reduction; default is OFF (full juicy) —
   confirm against Zoe's tolerance in practice.
3. **Keyboard vs pointer feel on PC** — follow-pointer is primary; verify arrow-key + mouse
   coexistence feels right with Zoe.
4. **Rainbow-mode variety knobs** — palette rotation + template-mixing cadence that keeps it
   fresh without extrinsic rewards.
5. **Final per-level enemy lineup & formation templates** — chosen during content authoring (the
   data format is fixed; the specific content is not yet).
6. **Exact logical resolution & aspect-aware column rules** — ~720×1280 baseline; refine the
   wide-screen column behavior during layout work.

## 12. References

- Research brief (UX, architecture, tech stack, with citations):
  [2026-06-25-unicorn-galaga-brief.md](../research/2026-06-25-unicorn-galaga-brief.md)
