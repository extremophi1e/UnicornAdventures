# Animal Soundboard — Design Spec

Date: 2026-06-27
Research brief: [docs/superpowers/research/2026-06-27-animal-soundboard-brief.md](../research/2026-06-27-animal-soundboard-brief.md)

**Goal:** A new no-fail "Animal Soundboard" mode for Zoe & Desi's Rainbow Unicorn
Adventures: a paged grid of big tappable creatures; tapping one plays a synthesized
"cute voice", bounces the emoji, briefly animates it, and fires a sparkle. No score,
no fail. Reached from a new title-screen button.

**Stack:** Phaser 4 + TypeScript + Vite (existing). Audio synthesized offline with
`@breezystack/lamejs` (existing dev dep). No new runtime dependencies.

## Global Constraints
- **No calm mode.** No `prefers-reduced-motion` / `matchMedia` branching in this
  mode — one consistent feel (full bounce, full sparkle, single voice volume). No
  background music.
- **No new graphics assets.** Reuse the already-loaded emoji spritesheets
  (`EMOJI_DEFS`) and the `catchUnicorn` sheet. The only new runtime asset is one
  audio sprite (MP3 + JSON), one extra `BootScene` fetch.
- **Pure logic in `src/core/` stays import-pure** (no Phaser/`render` imports) and
  Vitest-tested; rendering lives in the scene. The ordered creature list references
  render keys, so it lives in the scene, not in `core/`.
- On-screen emoji size rule (project-wide): displayed size = `setScale × 144`.
- No-fail, no score, no game-over.

---

## 1. Scope — the 53 buttons

`src/render/emoji.ts` has 61 entries. The board uses every **creature**, i.e. all 61
**except** the 9 objects/plants and the duplicate cat:
`cloud, star, icecream (tulip), balloon, heart, flower, gem, cupcake (clover),
lollipop (a duplicate cat-face glyph of cat)`. That leaves **52 emoji creatures**.
Note `donut` renders as a **ladybug** (codepoint 1f41e) and is kept. Add the
**unicorn** (its own `catchUnicorn` sheet, marker name `"unicorn"`) → **53 buttons**.

### Ordered list (family-grouped; unicorn last) — `SOUNDBOARD_ORDER`
1. Pets: `cat, dog, rabbit, chipmunk, rat`
2. Farm: `cow, pig, horse, goat, ox, chick, rooster`
3. Wild mammals: `fox, bear, panda, lion, tiger, sloth, raccoon, hedgehog, kangaroo`
4. Primates: `monkey, gorilla, orangutan`
5. Sea: `octopus, turtle, whale, crab, penguin, otter, seal, lobster, jellyfish`
6. Birds: `owl, peacock, eagle, flamingo, dove`
7. Reptiles & amphibians: `frog, snake, lizard`
8. Bugs: `butterfly, snail, ant, donut, microbe`
9. Dinos: `trex, sauropod`
10. Fantasy & silly: `robot, alien, ghost, poop`
11. `unicorn`

(53 total: 5+7+9+3+9+5+3+5+2+4+1.) The marker name for each button equals its key
(the `donut` button's marker is `"donut"` but it's a ladybug voice; `"unicorn"` is the
extra). This same ordered key list (minus rendering) is the source of marker names the
build script must produce.

---

## 2. Pure logic — `src/core/soundboardLayout.ts` (Vitest-tested)

The only pure/testable piece is the responsive paged-grid math.

```ts
export interface GridOpts {
  margin?: number;        // px clear at left/right/edges (default 24)
  gap?: number;           // px between cells (default 18)
  topReserved?: number;   // px reserved at top for score-less header/back (default 120)
  bottomReserved?: number;// px reserved at bottom for arrows/dots/peek (default 150)
  minCell?: number;       // smallest acceptable square cell px (default 132)
  maxCell?: number;       // largest square cell px (default 188)
}
export interface GridLayout {
  cols: number;
  rows: number;
  perPage: number;        // cols * rows
  pages: number;          // ceil(count / perPage), >= 1
  cellSize: number;       // square cell px (button hit cell)
  originX: number;        // x of the centre of cell (col 0)
  originY: number;        // y of the centre of cell (row 0)
  cellCenters: { cx: number; cy: number }[]; // length perPage, page-independent
}
export function computeGrid(
  viewportW: number, viewportH: number, count: number, opts?: GridOpts,
): GridLayout;
```

**Algorithm** (maximize comfortable density):
- `contentW = viewportW - 2*margin`, `contentH = viewportH - topReserved - bottomReserved`.
- `cols = max(1, floor((contentW + gap) / (minCell + gap)))`.
- `cellW = min(maxCell, (contentW - (cols-1)*gap) / cols)`.
- `rows = max(1, floor((contentH + gap) / (cellW + gap)))`.
- `cellSize = cellW` (square). `perPage = cols*rows`. `pages = max(1, ceil(count/perPage))`.
- Center the `cols×rows` block in the content area → `originX/originY` and the
  `perPage` `cellCenters`.

Plus a tiny pure helper:
```ts
export function pageSlice<T>(items: readonly T[], page: number, perPage: number): T[];
// items.slice(page*perPage, page*perPage + perPage)
```

**Test cases** (`tests/core/soundboardLayout.test.ts`):
- Narrow phone `computeGrid(520,1280,53)`: `cols>=3`, `cellSize` in `[132,188]`,
  `perPage = cols*rows`, `pages = ceil(53/perPage)`, `cellCenters.length === perPage`,
  all centers within `[margin, viewportW-margin]` × `[topReserved, viewportH-bottomReserved]`.
- Wide `computeGrid(1100,1280,53)`: `cols` strictly greater than the narrow case.
- `pages * perPage >= 53`; `pages >= 1`.
- Degenerate `computeGrid(300,400,53)` still returns `cols>=1, rows>=1, pages>=1`.
- `pageSlice([...53], lastPage, perPage)` returns the remaining tail (length ≤ perPage).

---

## 3. Scene — `src/scenes/SoundboardScene.ts` (key `"Soundboard"`)

Registered in `src/main.ts` scene list (after `Gumball`).

**Layout:** background reused from an existing UI background (use `PlayroomBackground`
to match the playful non-game modes; or `Background`). Top-left could show a friendly
title-less header; top-right a plain `⬅` back button (`scene.start("Title")`),
consistent with the other modes. Call `computeGrid(this.scale.width,
this.scale.height, SOUNDBOARD_ORDER.length)` to get the grid; render the current
page's buttons at `cellCenters`.

**Button:** a soft rounded-rect card (graphics) sized to `cellSize`, with the creature
sprite centered on it at `setScale(cellSize*0.6 / 144)` (≈60% of the cell), shown at
its **static first frame** (do not `.play()` at idle). The unicorn button uses
`CATCH_UNICORN_KEY` + a static frame. A `Phaser.GameObjects.Zone` of `cellSize`
(hit-area expanded ~10px) handles input.

**Paging:** large ◀ ▶ arrow buttons near the bottom (hidden at the first/last page
edges) and horizontal swipe (pointer down→up with horizontal delta over a threshold
flips page); a row of small page dots as decoration; the next page's first button
"peeks" ~24px in from the right edge. Page change rebuilds/repositions the button
pool (pool & reuse the sprites/cards across pages; only `SOUNDBOARD_ORDER` slice
changes). Use `input.dragDistanceThreshold` so a tap isn't swallowed by a drag.

**Tap (on the button zone):**
1. If the pointer moved beyond the drag threshold since down → treat as swipe, no tap.
2. Else: `this.sound2.voice(marker)` (cut-off-previous), a ~180ms squash-stretch
   bounce tween on the sprite (`scaleX*1.18 / scaleY*0.86` → back), `this.fx.popAt(cx, cy)`
   sparkle, and play the creature's looping animation for ~800ms then stop back to the
   static frame. Re-tapping retriggers.

**No score, no fail, no music.** Stop all sound on `SHUTDOWN`.

---

## 4. Audio — synth + sprite + wiring

### 4a. Build script `scripts/build-soundboard-audio.mjs` (`npm run soundboard-audio`)
Mirrors `scripts/build-audio.mjs` (same `SAMPLE_RATE 44100`, `CHANNELS 1`,
`f32ToI16`, `encodeToMp3`, `sine`, envelope helpers). Adds:
- helpers: `pitchContour(points, durationSec)` (exponential interpolation between
  `[ms,Hz]` anchors → per-sample freq array), `osc(freqArray, waveform, amp)`,
  a simple **biquad band-pass** (formant), `noise(amount, cutoff)`, `vibrato`,
  `amPulse(rate)`, `fm(carrierFreq, ratio, index)`, `peakNormalize(buf, 0.7)`.
- a **per-creature parameter table** `VOICES` keyed by the same names as
  `SOUNDBOARD_ORDER` (52 creatures + `unicorn`). Each entry:
  `{ f0, waveform, contour:[[ms,Hz]...], vibratoRate, vibratoDepth, formantFreq,
     formantQ, noiseAmount, noiseCutoff, amPulseRate, fmRatio, fmIndex,
     attackMs, decayMs, sustain, releaseMs, durationMs }`.

**Archetype recipes** (seed values; tune by ear). Assign each creature to an
archetype, then nudge `f0`/`durationMs` so siblings differ:
- **meow** (cats/small): sine, contour rise→fall (e.g. 300→650→260Hz over ~480ms),
  formant ~1000Hz Q8, slight tremolo tail, tiny noise.
- **woof/bark** (dog, fox): sawtooth, 2 quick down-sweeps (400→150Hz, ~90ms each),
  lowpass ~700Hz, punchy attack.
- **moo/low** (cow, ox, whale, gorilla, trex, sauropod): sawtooth low `f0`
  (90–130Hz), slow downward contour, formants ~200/800Hz, no noise, longer duration.
- **chirp/tweet** (chick, birds, bat-likes): sine quick up-blip (1000→3000Hz, ~60ms),
  optional repeat, airy high-passed noise.
- **ribbit/trill** (frog, bugs: ant, snail, microbe, ladybug): `amPulseRate` ~30–40Hz
  on a mid sine/saw, short.
- **squeak** (rat, mouse, chipmunk, rabbit, bat): high sine (700–1200Hz) quick up-down.
- **trumpet/honk** (eagle, peacock, rooster, flamingo, goat, pig): saw + formant, mid `f0`.
- **hiss/slither** (snake, lizard): filtered noise + low sine, downward.
- **robot**: square + ring-mod / non-integer FM (`fmRatio` ~1.4, `fmIndex` high), no
  vibrato, stutter `amPulse`.
- **alien**: FM big index, jumpy contour, fast tremolo, odd harmonic ratio.
- **ghost**: sine, slow 3Hz waver, soft long envelope.
- **poop**: comedic descending "blblblb" (low saw + fast amPulse, downward contour).
- **unicorn**: sine sparkle glide up + detuned shimmer partial (bell), no noise — the
  showcase voice.

Synthesis loop: synth each `VOICES[name]` → Float32 → `peakNormalize`; concat in
`SOUNDBOARD_ORDER` with a **400ms silence gap** between segments, tracking cumulative
start/end in seconds; encode the whole buffer **once** with lamejs (ensure `flush()`
is concatenated so the last voice isn't truncated). Write:
- `public/audio/animalvoices.mp3`
- `public/audio/animalvoices.json` in audiosprite/Phaser format:
  ```json
  { "resources": ["animalvoices.mp3"],
    "spritemap": { "cat": { "start": 0.0, "end": 0.48 }, "dog": { "start": 0.88, "end": 1.18 }, "...": {} } }
  ```

### 4b. `BootScene.preload()` — one new line
```ts
this.load.audioSprite("animalvoices", "audio/animalvoices.json", ["audio/animalvoices.mp3"]);
```

### 4c. `Sound` class — new `voice()` method
```ts
private _voices?: Phaser.Sound.BaseSound; // retained audiosprite instance (cut-off-previous)
voice(marker: string, volume = 0.7): void {
  if (!this._voices) this._voices = this.scene.sound.addAudioSprite("animalvoices");
  this._voices.stop();
  (this._voices as Phaser.Sound.WebAudioSound).play(marker, { volume });
}
```
Cut-off-previous: stop the prior voice before playing the new marker (latest tap wins).

**Smoke-test before locking the build output:** confirm Phaser 4's audiosprite loader
accepts the `spritemap {start,end}` shape and that `addAudioSprite(...).play(marker)`
works; if Phaser expects `duration` instead of `end`, adjust the emitted JSON.

---

## 5. Title screen — fit a 5th button
`src/scenes/TitleScene.ts`: compress the single column so all 5 buttons fit on the
1280-tall canvas (tighten spacing, nudge the bobbing unicorn up and/or slightly
smaller). Concrete layout: unicorn hero `y≈380` (scale `~0.7`, bob target `~350`);
five buttons at spacing 118 starting `y=630` → **630, 748, 866, 984, 1102** (last
bottom ≈ 1157 < 1280). The 5th button:
`this.makeButton(W/2, 1102, "🔊", "Animal Sounds", 0x00b4d8, () => this.go("Soundboard"))`,
with the existing four moved to 630/748/866/984. Keep the existing `makeButton`/`go`
machinery (Soundboard, like the other modes, is entered only once audio is unlocked).

---

## 6. File changes summary
- **Create** `scripts/build-soundboard-audio.mjs` — synth + bake one MP3 audio sprite + JSON.
- **Create** `src/core/soundboardLayout.ts` — pure `computeGrid` + `pageSlice`.
- **Create** `tests/core/soundboardLayout.test.ts` — Vitest cases above.
- **Create** `src/scenes/SoundboardScene.ts` — the scene (grid, paging, tap feedback).
- **Modify** `src/scenes/BootScene.ts` — load the audio sprite (1 line).
- **Modify** `src/audio/sound.ts` — add `voice(marker, volume)`.
- **Modify** `src/scenes/TitleScene.ts` — compress layout + 5th button.
- **Modify** `src/main.ts` — register `SoundboardScene`.
- **Modify** `package.json` — `"soundboard-audio": "node scripts/build-soundboard-audio.mjs"`.
- **Generated assets** (committed): `public/audio/animalvoices.mp3`, `public/audio/animalvoices.json`.

## 7. Verification
- `npx tsc --noEmit`; `npm test` (existing 72 + new `soundboardLayout` tests);
  `npm run build`.
- `npm run soundboard-audio` generates the MP3 + JSON; confirm all 53 markers present
  in the JSON and the MP3 is a sane size (~a few hundred KB).
- Preview: open Soundboard from the title; verify the grid pages, tapping plays
  distinct voices (spot-check several incl. unicorn), bounce + sparkle fire, paging
  works, and the audiosprite loads (markers resolve).

## 8. Open items (resolved during implementation)
- Exact per-creature synth parameters need ear-tuning; the plan seeds all 53 from the
  archetypes above and iterates on the fantasy voices for distinctiveness.
- Phaser audiosprite JSON field (`end` vs `duration`) — smoke-test, adjust if needed.
- Voice policy is **cut-off-previous** (single channel); order is **family-grouped**
  (both approved).
