# Research Brief — Zoe's Rainbow Unicorn (gentle Galaga clone)

**Date:** 2026-06-25
**Topic:** No-fail, browser-based, kid-friendly Galaga clone for a 4-year-old
**Status:** Research complete — feeds the design spec.

## Context (locked from grilled intake)

A web app / PWA running on a Windows PC (keyboard+mouse) and a phone (touch). Player is a
winged **pink unicorn** firing **rainbow stars** upward with **autofire**; movement via
keyboard arrows, mouse, and touch-drag. **No-fail** (enemy contact = harmless bounce +
sparkle). Core loop = Galaga-style **clear-the-wave**; formations drift/sway, no swooping.
Progression = ~10–12 finite levels + friendly bosses at 5, 10, and a final boss, then an
unlocked endless **rainbow mode** (in v1). Enemies = cute things (clouds, cupcakes, stars,
lollipops), **one type per level**, mixing later; bosses = a giant version. Art = **emoji /
simple shapes**, swappable later. Audio = cheerful music + SFX, **no voice**. Personalized
for **Zoe**. Success = starts in seconds with no reading, she progresses mostly on her own,
feels accomplished, never cries, works on both devices.

---

## Axis 1 — UX (interaction patterns for ages 3–5)

### Key findings

- **No menus for non-readers.** Drop straight into play, or a single giant animated Play
  target where any tap/key starts. Pre-readers treat text as visual noise; rely on images,
  motion, sound, and a mascot. Icons must be literal (the actual enemy/reward), never
  abstract (no hamburger, no floppy-disk save, no stars-as-currency).
  [tutsplus](https://gamedevelopment.tutsplus.com/how-to-design-a-menu-interface-for-a-toddlers-game-or-app--cms-20824t),
  [UXmatters](https://www.uxmatters.com/mt/archives/2020/01/ux-design-for-kids-key-design-considerations.php),
  [Sesame Workshop PDF](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf)
- **Huge touch targets + generous hitboxes.** NN/g recommends **≥2cm×2cm** targets for young
  children (4× the adult minimum); BBC GEL uses ≥64px hit areas with the *hit area larger than
  the visible graphic*. Aim-assist ("area cursor" oversized collision + "bullet magnetism"
  curving shots toward targets) makes near-misses count — directly applicable to the rainbow
  stars.
  [NN/g children](https://www.nngroup.com/articles/children-ux-physical-development/),
  [BBC GEL](https://www.bbc.co.uk/gel/features/how-to-design-for-children),
  [Witchfire aim assist](https://www.theastronauts.com/2019/02/witchfire-aim-assist/)
- **Follow-the-pointer is the most forgiving control** for tiny hands (direct touch beats
  indirect mouse for preschoolers; 3-year-olds struggle with a mouse). Autofire-with-
  positioning is a proven kid/casual convention ("positioning is the real skill"). Avoid
  drag-and-drop as a *primary* mechanic and any pinch/rotate gestures (unreliable before 6–7).
  [NN/g children](https://www.nngroup.com/articles/children-ux-physical-development/),
  [Mr. Autofire](https://paizix.com/games/casual/mr-autofire/)
- **No-fail ≠ tension-free.** The Toca Boca / Pok Pok model (no score, no game-over, mistakes
  just reset) "eliminates fear of failure," but a too-safe game gets boring. Keep engagement
  via surprise/variety, a visible friendly adversary, and an "almost done" feel — never timers
  or peril. Target essentially-always-wins, but waves should feel like a real (winnable)
  few-second obstacle.
  [gapsystudio](https://gapsystudio.com/blog/ux-design-for-kids/),
  [BBC GEL](https://www.bbc.co.uk/gel/features/how-to-design-for-children),
  [GameDeveloper](https://www.gamedeveloper.com/design/designing-for-kids-infusions-of-life-kisses-of-death)
- **Juice has a ceiling.** Particles, squash-stretch, ascending tones, fanfares are the right
  palette — but excessive redundant feedback raises cognitive load and *hurts* performance, and
  audio is the #1 overstimulation vector for preschoolers. Tier it: small per-hit pop, medium
  wave-clear fanfare, big *rare* boss celebration (the only place for screen-shake). Pok Pok
  (Apple Design Award) wins via *calm, never overstimulating* design — argues for a parent
  "calm/reduced-motion" toggle and conservative loudness. Keep rewards experiential
  ("look what YOU did!"), not numeric/score-based (toddlers don't grok scoring; over-reliance
  on extrinsic rewards risks an engagement drop when they stop).
  [game juice study](https://www.academia.edu/28934462/Good_Feedback_for_bad_Players_A_preliminary_Study_of_juicy_Interface_feedback),
  [screen-shake craft](https://sensecentral.com/how-to-add-screen-shake-particles-and-hit-feedback-correctly/),
  [Pok Pok](https://apps.apple.com/us/app/pok-pok-toddler-games-2-7/id1550204730)
- **Fullscreen / privacy / safety.** PWA `display:standalone` + iOS status-bar meta for
  chromeless fullscreen (iOS does **not** honor `fullscreen`). The real anti-exit lock is
  OS-level: **iOS Guided Access / Android Screen Pinning** — document for Dad. Use a parental
  gate (2-second corner-hold) in front of any settings/links. **Build zero-data**: no accounts,
  analytics, ads, or IAP; progress in `localStorage` only — satisfies COPPA / UK AADC / CA
  CAADC by construction (the game is "directed to children" regardless of any age gate).
  [PWA on iOS](https://firt.dev/notes/pwa-ios),
  [Guided Access](https://support.apple.com/en-us/111795),
  [COPPA 2025 guide](https://blog.promise.legal/startup-central/coppa-compliance-in-2025-a-practical-guide-for-tech-edtech-and-kids-apps/)
- **Pitfalls:** ages 3–5 can't separate fantasy from reality — avoid looming/roaring bosses,
  jump-scare stings, loud/sudden noises. Avoid small targets, timing/rhythm mechanics, time
  pressure, long loading screens, and **bottom-edge controls** (resting wrists bump them).
  If it doesn't make sense in ~2 tries, a child quits.
  [scary content](https://www.sheknows.com/parenting/articles/1099631/is-your-preschooler-ready-for-scary-content/),
  [game studies](https://gamestudies.org/1001/articles/bryant_akerman_drell)

### Recommendation

Launch straight to play (or one giant bouncing-unicorn start). First wave *is* the tutorial —
unicorn auto-follows the pointer/finger and autofires immediately. **Primary control =
follow-the-pointer on all devices** (touch-drag / mouse / cursor), with keyboard arrows
driving the same target X as a supplement. Generously oversized enemy hitboxes + light bullet
magnetism so near-misses land. No-fail bounce-and-sparkle on contact. **Tiered celebrations**
(per-hit → wave-clear → rare boss spectacle), experiential not score-based. Ship a parent
**calm mode** (reduced motion + lower SFX) and conservative default volume. `standalone` PWA;
parental gate on settings; **zero data collection, localStorage only**; a one-time Dad note on
Add-to-Home-Screen + Guided Access. Keep all controls away from the bottom edge.

### Open questions

1. On the PC, is keyboard a co-equal input or a fallback? (Mouse-follow + arrow keys both
   moving the same unicorn can feel inconsistent — worth testing with Zoe.)
2. How long should a boss resist before a 4-year-old reads it as "stuck"? (Playtest; patience
   cliff is short.)
3. Calm/reduced-motion default ON or OFF? (Pok Pok argues calm; the rainbow core argues juicy.)
4. What sustains the endless rainbow mode intrinsically (new palettes? gentle variety) without
   leaning on extrinsic rewards?
5. Cross-device progress: localStorage doesn't sync PC↔phone — is independent per-device
   progress acceptable? (Likely yes.)

---

## Axis 2 — Architecture (how to structure it)

### Key findings

- **Loop:** `requestAnimationFrame` with **fixed-timestep update (1/60s) + variable render**;
  derive all motion from delta-time (per-second units), **clamp dt** (~0.25s) and cap catch-up
  steps (~5) to avoid teleporting after a backgrounded tab and the "spiral of death." Test on a
  real 120 Hz phone.
  [game loop](https://jakesgordon.com/writing/javascript-game-foundations-the-game-loop/),
  [frame timing](https://solana.garden/guides/game-loop-frame-timing-explained/)
- **Entities:** a shallow class hierarchy (or flat component composition) beats full ECS at this
  scale — ECS is "boilerplate without payoff" below thousands of entities.
  [ECS for browser games](https://simplified.media/guides/ecs-browser-games)
- **Object pooling is the #1 perf decision.** Pre-allocate bullets/enemies/particles/floating
  celebration objects/audio nodes; activate-deactivate instead of new/free; array `push`/`pop`
  (never `shift`); `reset()` on reuse. Target **zero allocations during a wave** (GC pauses run
  50–100 ms on mobile). Don't pool the singleton player; size enemy pool to the largest single
  wave.
  [object pooling](https://github.com/raduacg/game-mechanics-optimizations/blob/main/01_object_pooling.md)
- **State machine** for scenes (boot → menu → levelIntro → playing → levelComplete → bossIntro
  → bossFight → finale → rainbowMode, + paused), each with enter/update/render/exit and
  **cleanup on exit** (stop music, drop listeners). Reuse the same tiny FSM for boss phases; run
  HUD/celebration overlay as a parallel layer.
  [state management](https://jakesgordon.com/writing/javascript-game-foundations-state-management/)
- **Data-driven waves, shared by finite + endless.** Author levels 1–12 as plain data
  (`{enemyType, formation, spawnPacing, driftParams, isBoss}`); a `WaveSpawner` consumes it.
  Rainbow mode emits the **same structure procedurally** via a depth-scaled **budget/cost**
  model + weighted formation templates. Scale difficulty by **count/variety, not HP inflation**
  (avoids bullet-sponge feel).
  [wave controller](https://www.gamedeveloper.com/programming/enemy-wave-controller-in-demons-with-shotguns),
  [budget spawning](https://gamedev.stackexchange.com/questions/60700/how-do-i-write-a-wave-spawning-system-for-a-shoot-em-up)
- **Collision:** brute-force **circle-vs-circle with layer pruning** (player-bullets→enemies;
  player→enemies). Spatial partitioning is overkill for one screen of ~100–200 objects; circle
  checks are cheap and forgiving for round emoji + generous kid hitboxes.
  [quadtree overkill](https://gamedev.net/forums/topic/590388-quadtree-for-2d-collision-detection/),
  [collision optimization](https://gamedev.stackexchange.com/questions/89683/optimizing-collision-detection-in-a-2d-game)
- **Renderer seam (emoji → custom art):** entities hold only draw *data* (pos, rot, scale,
  `spriteId`); a separate `Renderer` interface (`drawSprite(spriteId,x,y,rot,scale)`,
  `drawText`, `drawRect`, `clear`) does all drawing. v1 resolves `spriteId`→emoji sprite; later
  the same interface resolves `spriteId`→spritesheet frame. Logic never imports the canvas.
  [separation of logic/render](https://gamedev.stackexchange.com/questions/125326/separating-game-logic-and-rendering)
- **Responsive (PC-landscape vs phone-portrait):** fixed **logical coordinate space**, scale-to-
  fit + letterbox via `ctx.setTransform`, DPR-aware backing store, recompute on
  `resize`/`orientationchange`. Because the two orientations differ so much, make the playfield
  **aspect-aware**: the formation layout reads current aspect (more columns when wide, more rows
  when tall).
  [responsive canvas](https://www.jgibson.id.au/blog/responsive-canvas/),
  [HTML5 resize case study](https://web.dev/case-studies/gopherwoord-studios-resizing-html5-games)
- **Boss:** its own small FSM (Entering → Idle/Move → Attack → PhaseTransition → Defeated);
  lerp-in then sinusoidal sway; **HP thresholds drive phases**; telegraph clearly; visible HP
  bar; reuse the pooled bullet/particle system. Keep to 2 gentle phases for a friendly boss.
  [boss AI states](https://janika-suhonen2.medium.com/2d-space-shooter-creating-boss-ai-with-enum-states-fd481fa815a7)
- **Input abstraction:** map key/mouse/touch into one semantic **"aim X"** action polled each
  tick (autofire means that's nearly the only action) so logic stays device-agnostic.
  [input concepts](https://docs.web-engine.dev/concepts/input)

### Recommendation

Single rAF loop, fixed-timestep update + once-per-frame render, dt-clamped. Shallow entity
classes (`Entity`→`Player/Enemy/Bullet/Particle/Boss`) holding a `spriteId`, no draw code.
Generic array-backed **pool** for bullets/enemies/particles/celebration objects. One top-level
**scene FSM** + a reused FSM for boss phases + a parallel HUD/overlay. A **`WaveSpawner`
consuming a wave-description data structure**, with levels 1–12 as static data and rainbow mode
as a procedural budget-based generator emitting the *same* structure. **Circle collision with
layer pruning**, generous hitboxes. **`Renderer` interface** as the art seam (emoji now,
sprites later). **Fixed logical space + scale-to-fit/letterbox, DPR-aware, aspect-aware
formation layout.** Unified semantic input layer ("aim X").

### Open questions

1. **Aspect strategy:** flexible aspect-aware playfield (recommended; more spawn-system work)
   vs one fixed near-square field letterboxed both ways (simpler; wastes screen). Decide
   *before* authoring levels — it shapes the wave data format.
2. Pick the **fixed logical resolution** (e.g. ~720×1280 portrait-ish, or square).
3. **Shell tech:** pure canvas + DOM menus vs a thin React/HTML shell for menus only (if React:
   "canvas owns gameplay, React owns chrome," watch StrictMode double-mount).
4. Render interpolation — start without it; revisit only if 120 Hz looks choppy.
5. Define the `spriteId` + frame/animation contract now (single frames vs spritesheets) so the
   art swap doesn't rework the seam.
6. Web Audio (pooled nodes, recommended) vs `<audio>` — see tech axis.
7. Persistence: save furthest level in localStorage? (affects FSM resume vs always-from-menu).

---

## Axis 3 — Tech stack

### Key findings

- **Phaser is the consensus default** for a small 2D browser game: batteries-included
  (WebGL+Canvas, input for keyboard/mouse/touch, audio, scenes, tweens, particles, loader),
  12+ years maintained, biggest tutorial/community base, and the **best AI-assist accuracy**
  (LLMs answer Phaser questions far better than Kaplay/Excalibur) — meaningful for a solo parent
  leaning on AI. Best Safari/iOS perf of the contenders.
  [framework comparison](https://generalistprogrammer.com/tutorials/best-html5-game-frameworks-2025),
  [Phaser vs Kaplay vs Excalibur](https://phaser.io/news/2026/04/phaser-vs-kaplay-vs-excalibur-2d-web-game-framework)
- **Phaser 4.0.0 shipped stable 2026-04-10** — new WebGL renderer, keeps the v3 API, now
  **modular ES modules with tree-shaking** (smaller real bundles), major mobile perf/memory
  gains, Canvas fallback retained. v3.90 remains a heavily-documented fallback if a needed
  tutorial/plugin is v3-only.
  [Phaser 4.0.0 release](https://github.com/phaserjs/phaser/releases/tag/v4.0.0)
- **Alternatives:** **PixiJS** = fastest renderer but *renderer only* (you add audio/input/
  scenes yourself + Howler). **KAPLAY** = the maintained successor to the now-abandoned
  Kaboom.js, easiest to learn, but perf degrades on bigger projects and weaker AI-assist. **Plain
  Canvas** = zero deps but you hand-roll everything.
  [Pixi comparison](https://generalistprogrammer.com/tutorials/phaser-vs-pixijs-renderer-comparison),
  [KAPLAY](https://github.com/kaplayjs/kaplay)
- **TypeScript + Vite** is the de-facto setup; Phaser's official "Create Game App" defaults to
  Vite + TS. Vite gives sub-second dev start + HMR + the PWA plugin with ~5–10 lines of config.
  TS pays off for the "extend it later" goal.
  [Phaser+Vite+TS](https://generalistprogrammer.com/tutorials/phaser-typescript-setup-vite-2025),
  [Vite](https://vite.dev/)
- **Audio:** if using Phaser, its **built-in Web Audio sound manager** does unlock-on-first-
  gesture — **Howler is redundant**. Unlock audio on the Start tap; avoid HTML5 `<audio>` (iOS
  per-tag locking bugs). Use **Howler only if you drop Phaser**. Free CC0 assets from **Kenney**
  first (Music Jingles win/lose stingers, UI sounds, sci-fi/laser SFX); OpenGameArt/Freesound/
  Pixabay as needed — prefer **CC0** (no attribution) over CC-BY (needs a credits screen).
  [Howler](https://howlerjs.com/),
  [Phaser audio unlock](https://github.com/phaserjs/phaser/issues/6417),
  [Kenney audio](https://kenney.nl/assets/category:Audio)
- **PWA:** **vite-plugin-pwa** (`registerType:'autoUpdate'`, maskable icons, manifest in one
  block). **iOS caveats:** no real fullscreen (`fullscreen`→`standalone`), no install prompt
  (`beforeinstallprompt` never fires — needs manual Share→Add to Home Screen, so show a custom
  iOS hint), SW storage cleared after ~7 days idle (don't store save-data *only* in SW cache),
  `100vh` includes chrome (use `dvh`). PC/Android can request the Fullscreen API on a gesture.
  [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa),
  [PWA iOS limits](https://blog.hashhackers.com/blog/pwa-ios-limitations/)
- **Hosting:** **Cloudflare Pages** recommended — **unlimited bandwidth** (no overage-billing
  risk), fastest global CDN, free HTTPS + custom domain, commercial-OK. **GitHub Pages** is the
  simplest if code already lives on GitHub (push-to-deploy), just no preview deploys. Avoid
  Vercel Hobby (non-commercial only).
  [hosting comparison](https://congero.com.au/blog/comparisons/best-free-static-website-hosting-2025-with-custom-subdomain/),
  [host free 2026](https://pressless.io/blog/host-website-free-2026)
- **Emoji consistency (IMPORTANT):** native emoji render differently per OS (Apple/Segoe/Noto/
  Samsung) and update at different rates → `fillText('🦄')` is inconsistent and sometimes broken
  across PC + phone. **Fix: bundle ONE emoji set pre-rendered to a PNG/WebP sprite atlas** and
  use it as sprites (pixel-identical everywhere, sidesteps font-format support, matches
  "swappable art later" = swap the atlas). **OpenMoji** (CC BY-SA, playful) or **Twemoji**
  (CC-BY, small/common) — both need a credit line; Noto (OFL) also an option.
  [emoji in canvas](https://lanceewing.github.io/blog/js13k/2020/10/04/using-emojis-in-a-point-and-click-adventure-part-2.html),
  [OpenMoji](https://github.com/hfg-gmuend/openmoji),
  [Twemoji](https://github.com/twitter/twemoji)

### Recommendation

**Phaser 4 + TypeScript + Vite** (via the official Create Game App, minimal template) — fastest
path to a polished, extensible 10–12-level game with bosses, best mobile/Safari perf, best
AI-assist for a solo parent. **Audio: Phaser's built-in Web Audio**, unlock on Start; assets
from **Kenney (CC0)**; skip Howler. **PWA: vite-plugin-pwa**, `display:standalone`, custom iOS
Add-to-Home-Screen hint, Fullscreen API on PC/Android, don't store progress only in SW cache.
**Hosting: Cloudflare Pages** (GitHub Pages as the simpler fallback). **Art: bundle OpenMoji or
Twemoji pre-rendered to a PNG/WebP atlas** used as sprites — never system-font emoji — kept
swappable, with the required attribution line.

> Note: Phaser provides its own scenes, loop, input, and pooling-friendly groups, which overlap
> the Axis-2 architecture. The architecture's *principles* (fixed-step/dt, pooling, data-driven
> waves shared with endless mode, renderer seam, aspect-aware layout, circle collision) still
> hold — Phaser supplies the scaffolding to implement them rather than hand-rolling from raw
> Canvas. The spec should reconcile "Phaser-native" vs "hand-rolled engine" explicitly.

### Open questions

1. **Phaser 4 (new, April 2026) vs plain Canvas/TS engine** — Phaser is faster to a polished
   result and gives input/audio/scenes free, but the Axis-2 plan reads as a hand-rolled engine.
   Pick one before the spec (this is the biggest tech decision).
2. **Phaser 4 vs 3.90** — v4 recommended, but tolerate newness vs the more heavily-documented v3?
3. Emoji set choice (OpenMoji CC-BY-SA *share-alike* vs Twemoji CC-BY) + where the credit line
   lives (tiny credits screen).
4. Save storage: best-effort `localStorage` for furthest level (no cloud/account — overkill for
   a 4-year-old)?
5. Custom domain (~$10–15/yr) vs a free `*.pages.dev` / `*.github.io` subdomain?
6. Confirm Howler is dropped if committing to Phaser.

---

## Cross-axis synthesis (the one decision to make first)

All three axes converge except on **engine approach**: Axis 2 describes a hand-rolled
Canvas/TS engine; Axis 3 recommends **Phaser 4** (which supplies loop/scenes/input/audio/pooling
out of the box). Both honor the same *principles* (no-fail forgiving UX, pooling, data-driven
waves shared by finite+endless, renderer/art seam, aspect-aware responsive layout, circle
collision, zero-data PWA). **Resolving Phaser-vs-hand-rolled is the first thing the design spec
must settle**, because it determines how every other component is built. Recommendation going
into the design phase: **Phaser 4 + TS + Vite**, applying the Axis-2 principles on top of
Phaser's scaffolding — fastest to something Zoe can play, with the extensibility the goals need.
