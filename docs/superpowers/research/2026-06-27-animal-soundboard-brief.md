# Animal Soundboard — Research Brief

Date: 2026-06-27
Feature: a new no-fail "Animal Soundboard" mode for Zoe & Desi's Rainbow Unicorn
Adventures. A grid of big tappable buttons — one per creature in `src/render/emoji.ts`
(53 creatures) plus the unicorn = **54 buttons**. Tap → play a synthesized cute
"voice", bounce/scale the emoji, fire a sparkle. No score, no fail, calm-mode aware.
Voices are baked offline into a single audio sprite (one MP3 + JSON marker map).

Intake decisions already locked:
- **Scope**: 54 buttons = 53 emoji creatures (everything in `emoji.ts` except the 8
  objects/plants cloud, star, icecream=tulip, balloon, heart, flower, gem,
  cupcake=clover, and except `lollipop` which is a duplicate cat-face glyph of
  `cat`) **plus the unicorn** (its own `catchUnicorn` sheet). Note `donut` renders
  as a **ladybug** (1f41e) → kept as a creature.
- **Voice character**: recognizable-but-cute **hybrid** — real animals get a
  stylized version of their real call; fantasy creatures (robot, alien, ghost,
  dino, microbe, ladybug, unicorn) get invented playful voices. All synthesized.

---

## UX — Interaction patterns

**Key findings**
- Tap is the only reliably usable gesture for ages 2–7; register feedback on
  touch-**down**, not lift, and make every tap produce **sound + animation together**
  (children lose confidence with only one). Touch targets should be large (~2cm /
  ≥75px; ~150px is comfortable), with hit areas expanded ~10px beyond the visual and
  dead-zones at screen edges. (NN/g children-UX; Sesame Workshop 2012; TIDRC 2019)
- **Vertical scrolling is explicitly "conceptually difficult" for this age group**;
  a **horizontal paged** layout with large arrows (swipe as a bonus) is the
  recommended pattern when content exceeds one screen. Page **dots are abstract** for
  pre-readers — use a "**peek**" (let the next page's first button bleed ~25px into
  the margin) to signal "there's more". (Sesame Workshop; UX Magazine; tutsplus)
- **Do not idle-animate buttons before they're tapped** — kids treat the animation as
  the button's whole purpose and tap less; animate **on interaction**. (TIDRC CI16)
- Calm/accessibility: honor `prefers-reduced-motion` (swap scale-bounce for a short
  opacity pulse; sparkles opacity-only, fewer particles); never flash >3×/sec (WCAG
  2.3.1); no autoplaying ambient music competing with the voices. (MDN; web.dev; WCAG)
- Childproof the exit: the "back" control should need a deliberate long-press or
  two-step tap so a stray palm-swipe can't drop out mid-play.

**Recommendation**
A **horizontal paged grid**, static emoji idle, animate-on-tap. Big rounded buttons
(~150px target, expanded hit area), gentle squash-and-stretch + small sparkle on tap,
cut-off-previous audio. Reduced-motion → opacity pulse instead of bounce, fewer
sparkles. A childproof back button (long-press) outside the grid. "Peek" the next
page; arrows + swipe to page; dots only as decoration.

**Open questions** → grill in design
- Paged vs gentle vertical scroll (research favors paged; the user's prompt said
  "scrollable/paged"). Decide cols×rows per page and total pages.
- Whether to group creatures by category (farm/ocean/fantasy) per page for
  discoverability, or keep `emoji.ts` order.
- Whether the back button needs childproofing here (other modes use a plain `⬅`).

---

## Architecture — Audio sprite, rendering, scrolling

**Key findings**
- Phaser loads an audio sprite in **one fetch**: `load.audioSprite(key, jsonUrl,
  [audioUrls])`; play via a retained `this.sound.addAudioSprite(key)` then
  `inst.play(marker)` (lets you `.stop()` to cut-off), or fire-and-forget
  `this.sound.playAudioSprite(key, marker)`. JSON uses a `spritemap` of
  `{ name: { start, end } }` in seconds. (Phaser 4 audio docs/skill)
- **MP3 marker-bleed pitfall**: encoders add padding. But because our sprite is **one
  continuous MP3**, the encoder/decoder delay happens **once at file start and is
  already baked into the decoded PCM**; seeking to a marker offset is then accurate.
  The only residual risk is a ~26–33ms tail bleeding into the following gap — fully
  absorbed by a silence gap between segments. (web.dev MSE; LAME tech FAQ; Hydrogenaudio)
- **iOS Safari still doesn't support OGG** (as of 2024), so **MP3 is the format we
  actually ship** to phones; OGG's gapless advantage is moot for the target devices.
- Rendering: Phaser 4 batches same-texture sprites; 54 animated sprites is well within
  "a few hundred sprites" comfort. **Crucially, all emoji spritesheets are already
  loaded by `BootScene`** (it loads every `EMOJI_DEFS` entry + the catchUnicorn
  sheet), so the board adds **no new texture/GPU cost** — only the single audio sprite.
- Scrolling in Phaser is hand-built (container + geometry mask + drag, or page-snap).
  Tap-vs-drag needs a threshold (`input.dragDistanceThreshold ≈ 16px`) so a tap
  doesn't get eaten by a drag.
- Rapid taps: Web Audio handles many concurrent one-shots cheaply; the right policy
  for a soundboard is **cut-off-previous** (stop the prior instance, replay). A
  master `DynamicsCompressorNode` guards against clipping if several fire at once.

**Recommendation**
Use Phaser's native `load.audioSprite` (one fetch) + a retained `addAudioSprite`
instance played through the existing `Sound` class (new method, e.g.
`Sound.voice(marker)` that stops the prior voice then plays). Ship **MP3 mono 44.1kHz**.
**Static idle, animate-on-tap** (also the UX + calm recommendation), so no continuous
54-sprite animation churn. For navigation, **paged grid** (snap) is simplest to get
right and dodges tap-vs-scroll ambiguity; if vertical scroll is chosen instead, use
container+mask with a 16px drag threshold.

**Open questions** → grill / verify in design
- Confirm Phaser 4's exact audiosprite JSON shape (`end` vs `duration`) with a tiny
  smoke test before locking the build-script output.
- Exact silence-gap length between voices (≥300–500ms is safe).

---

## Tech Stack — Offline synthesis + sprite baking

**Key findings**
- Cute/animal/cartoon voices come from a **source-filter** approach reproducible with
  plain oscillator math: a voiced source (sine/saw/square/triangle) + optional noise,
  shaped by a **pitch contour** (the #1 cue: meow = rise-fall, woof = fast down-sweep,
  chirp = quick up-blip, moo = low slow fall), **vibrato/tremolo** LFOs, **formant**
  band-pass filtering for a "vocal" vowel feel, **FM/ring-mod** for robot/alien metal,
  **AM pulse** for frog ribbit / insect trill, and an **ADSR** envelope. (Anikin
  soundgen; MDN Advanced techniques; tsugi cartoon-SFX; greweb FM)
- Baking offline: the `audiosprite` npm tool needs **ffmpeg** (external dep) — avoid.
  **Hand-rolling** the sprite (synth each voice → Float32 PCM → concat with silence
  gaps, track offsets, emit JSON, encode once with `@breezystack/lamejs`) is
  self-contained and **mirrors the existing `build-audio.mjs`** exactly. (npm
  audiosprite; existing pipeline)
- Kid-safe audio: gentle attack/release to avoid clicks, peak-normalize each voice
  (~0.7 / −3dBFS) for balance, soft compressor before encode, major-key/clean
  timbres. (gamedeveloper.com pre-school audio; mastering guides)
- Pure-JS synthesis: hand-rolled `for`-loop oscillator math has zero deps and is
  plenty fast (~1M samples total). A pure-JS `web-audio-api` OfflineAudioContext lib
  exists if the biquad/formant graph gets complex, but is optional.

**Recommendation**
`scripts/build-soundboard-audio.mjs`: hand-rolled oscillator synth driven by a
**per-animal parameter table** with these dimensions — `f0`, `waveform`,
`pitchContour [[ms,Hz]...]`, `vibratoRate/Depth`, `formantFreq/Q` (1 formant default,
2 for the most voice-like), `noiseAmount/noiseCutoff`, `amPulseRate` (ribbit/trill),
`fmRatio/fmIndex` (robot/alien), `attack/decay/sustain/release`, `durationMs`. Synth →
Float32 → peak-normalize → concat with **~400ms silence gaps** tracking second
offsets → emit `spritemap` JSON `{name:{start,end}}` → encode one **MP3 (lamejs,
mono, 44.1kHz)**. Keep the param table in the build script (like `build-emoji.mjs`'s
TYPES map). Reuse the existing `sine`/envelope helpers; add biquad + contour helpers.

Per-creature starter recipes (from research): cat meow (sine, 300→600→200Hz glide,
formant ~1kHz, tremolo tail); dog woof (saw, 400→150Hz fast, lowpass, 2 bursts); cow
moo (saw ~110Hz, slow fall, formants 200/800); frog ribbit (AM pulse ~35Hz, sub
~950Hz); bird chirp (sine up-blip 1k→3kHz + airy noise); robot (square + ring-mod /
non-integer FM, no vibrato, stutter AM); ghost (sine, slow 3Hz waver, soft envelope);
alien (FM big index, random pitch jumps, fast tremolo); unicorn (sine sparkle glide +
detuned shimmer bell, no noise); ladybug/ant/insects (short buzzy AM trill).

**Open questions** → grill / iterate
- Formant fidelity: 1 formant (cartoon) vs 2 cascaded (more animal-like). Default 1,
  upgrade specific voices if needed.
- Fantasy-creature distinctiveness needs listening iteration (can't fully pre-spec).
- Sample rate 44.1k vs 22.05k (smaller file; cartoon voices rarely exceed ~6kHz).
- Confirm lamejs `flush()` is concatenated so the last voice isn't truncated.

---

## Cross-cutting conclusions

1. **No new graphics assets** — reuse already-loaded emoji + unicorn sheets. The only
   new runtime asset is one audio sprite (MP3 + JSON), one extra `BootScene` fetch.
2. **Static idle + animate-on-tap** satisfies UX (encourages tapping), calm-mode, and
   performance simultaneously — a happy three-way win.
3. **MP3 is correct** (iOS), and a single continuous MP3 sidesteps most marker-bleed;
   a ~400ms gap removes the rest.
4. **Hand-rolled synth + hand-rolled baking** keeps zero new runtime deps and mirrors
   the existing `build-audio.mjs`, exactly as requested.
5. Likely **little/no pure `core/` logic** — the one testable candidate is grid
   layout/pagination math (positions, page count) and possibly the creature-list
   derivation (filter `emoji.ts` → creatures). Decide in design.
