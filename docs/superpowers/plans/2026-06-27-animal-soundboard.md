# Animal Soundboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a no-fail "Animal Soundboard" mode — a paged grid of 53 big tappable creatures that each play a synthesized cute voice with a bounce + sparkle.

**Architecture:** A new `SoundboardScene` renders a responsive paged grid (positions from a pure, tested `core/soundboardLayout.ts`). All 53 voices are synthesized offline by `scripts/build-soundboard-audio.mjs` into ONE MP3 audio sprite + a JSON marker map, loaded by `BootScene` in a single fetch and played through a new `Sound.voice()` method (cut-off-previous). Reuses already-loaded emoji + catch-unicorn spritesheets (no new graphics).

**Tech Stack:** Phaser 4, TypeScript, Vite, Vitest, `@breezystack/lamejs` (offline MP3 synthesis, existing dev dep). No new runtime dependencies.

**Spec:** [docs/superpowers/specs/2026-06-27-animal-soundboard-design.md](../specs/2026-06-27-animal-soundboard-design.md)
**Brief:** [docs/superpowers/research/2026-06-27-animal-soundboard-brief.md](../research/2026-06-27-animal-soundboard-brief.md)

## Global Constraints
- **No calm mode**: no `prefers-reduced-motion`/`matchMedia` in this mode; one consistent feel; no background music.
- **No new graphics assets**: reuse `EMOJI` spritesheets (already loaded) + `catchUnicorn` sheet. Only new runtime asset is one audio sprite (MP3 + JSON).
- **`src/core/` stays import-pure** (no Phaser / `src/render` imports), Vitest-tested. Rendering lives in the scene.
- **TypeScript is strict** with `noUnusedLocals` + `noUnusedParameters` ON — no unused variables/params (prefix intentionally-unused params with `_`).
- On-screen emoji size rule: displayed px = `setScale × 144`.
- No score, no fail, no game-over.
- **Canonical creature order** (53 marker names; used identically by the build script's `VOICES` table and the scene's `SOUNDBOARD_ORDER`):
  `cat, dog, rabbit, chipmunk, rat, cow, pig, horse, goat, ox, chick, rooster, fox, bear, panda, lion, tiger, sloth, raccoon, hedgehog, kangaroo, monkey, gorilla, orangutan, octopus, turtle, whale, crab, penguin, otter, seal, lobster, jellyfish, owl, peacock, eagle, flamingo, dove, frog, snake, lizard, butterfly, snail, ant, donut, microbe, trex, sauropod, robot, alien, ghost, poop, unicorn`
  (52 emoji creatures + `unicorn`. Note `donut` is the ladybug glyph.)

## File Structure
- **Create** `src/core/soundboardLayout.ts` — pure grid/pagination math.
- **Create** `tests/core/soundboardLayout.test.ts` — Vitest cases.
- **Create** `scripts/build-soundboard-audio.mjs` — synth + bake one MP3 sprite + JSON.
- **Create** `src/scenes/SoundboardScene.ts` — the scene.
- **Modify** `src/scenes/BootScene.ts` — load the audio sprite (1 line).
- **Modify** `src/audio/sound.ts` — add `voice()`.
- **Modify** `src/scenes/TitleScene.ts` — compress layout + add 5th button.
- **Modify** `src/main.ts` — register `SoundboardScene`.
- **Modify** `package.json` — add `soundboard-audio` script.
- **Generated (committed)** `public/audio/animalvoices.mp3`, `public/audio/animalvoices.json`.

---

### Task 1: Pure grid layout (`core/soundboardLayout.ts`)

**Files:**
- Create: `src/core/soundboardLayout.ts`
- Test: `tests/core/soundboardLayout.test.ts`

**Interfaces:**
- Produces: `computeGrid(viewportW: number, viewportH: number, count: number, opts?: GridOpts): GridLayout` and `pageSlice<T>(items: readonly T[], page: number, perPage: number): T[]`.
  - `GridLayout = { cols, rows, perPage, pages, cellSize, originX, originY, cellCenters: {cx,cy}[] }` (all numbers; `cellCenters.length === perPage`).
  - `GridOpts = { margin?, gap?, topReserved?, bottomReserved?, minCell?, maxCell? }` (defaults: 24, 18, 120, 150, 132, 188).

- [ ] **Step 1: Write the failing tests**

Create `tests/core/soundboardLayout.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeGrid, pageSlice } from "../../src/core/soundboardLayout";

describe("computeGrid", () => {
  it("packs a dense, tappable grid on a narrow phone (520x1280, 53 items)", () => {
    const g = computeGrid(520, 1280, 53);
    expect(g.cols).toBe(3);
    expect(g.rows).toBe(6);
    expect(g.perPage).toBe(18);
    expect(g.pages).toBe(3); // ceil(53/18)
    expect(g.cellSize).toBeGreaterThanOrEqual(132);
    expect(g.cellSize).toBeLessThanOrEqual(188);
    expect(g.cellCenters).toHaveLength(18);
  });

  it("uses more columns on a wide screen (1100x1280)", () => {
    const narrow = computeGrid(520, 1280, 53);
    const wide = computeGrid(1100, 1280, 53);
    expect(wide.cols).toBeGreaterThan(narrow.cols);
  });

  it("keeps every cell centre inside the content area", () => {
    const W = 600, H = 1280, margin = 24, top = 120, bottom = 150;
    const g = computeGrid(W, H, 53, { margin, topReserved: top, bottomReserved: bottom });
    for (const c of g.cellCenters) {
      expect(c.cx).toBeGreaterThanOrEqual(margin);
      expect(c.cx).toBeLessThanOrEqual(W - margin);
      expect(c.cy).toBeGreaterThanOrEqual(top);
      expect(c.cy).toBeLessThanOrEqual(H - bottom);
    }
  });

  it("covers all items: pages * perPage >= count, and always >= 1 page", () => {
    const g = computeGrid(520, 1280, 53);
    expect(g.pages * g.perPage).toBeGreaterThanOrEqual(53);
    expect(computeGrid(300, 400, 53).pages).toBeGreaterThanOrEqual(1);
    expect(computeGrid(300, 400, 53).cols).toBeGreaterThanOrEqual(1);
    expect(computeGrid(300, 400, 53).rows).toBeGreaterThanOrEqual(1);
  });
});

describe("pageSlice", () => {
  const items = Array.from({ length: 53 }, (_, i) => i);
  it("returns the page's window", () => {
    expect(pageSlice(items, 0, 18)).toEqual(items.slice(0, 18));
    expect(pageSlice(items, 1, 18)).toEqual(items.slice(18, 36));
  });
  it("returns the short tail on the last page", () => {
    expect(pageSlice(items, 2, 18)).toEqual(items.slice(36, 53)); // length 17
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/soundboardLayout.test.ts`
Expected: FAIL (cannot find module `../../src/core/soundboardLayout`).

- [ ] **Step 3: Implement `computeGrid` + `pageSlice`**

Create `src/core/soundboardLayout.ts`:
```ts
// Pure, framework-free grid/pagination math for the Animal Soundboard. No Phaser
// or render imports — unit-tested headlessly. Maximises comfortable button density:
// pick the most columns whose cells are >= minCell, square the cells, fill the rows
// that fit, and centre the block in the content area.

export interface GridOpts {
  margin?: number;        // clear px at the left/right edges (default 24)
  gap?: number;           // px between cells (default 18)
  topReserved?: number;   // px reserved at the top (header/back) (default 120)
  bottomReserved?: number;// px reserved at the bottom (arrows/dots) (default 150)
  minCell?: number;       // smallest acceptable square cell px (default 132)
  maxCell?: number;       // largest square cell px (default 188)
}

export interface GridCell { cx: number; cy: number; }

export interface GridLayout {
  cols: number;
  rows: number;
  perPage: number;
  pages: number;
  cellSize: number;
  originX: number;            // centre x of column 0
  originY: number;            // centre y of row 0
  cellCenters: GridCell[];    // length perPage, page-independent
}

export function computeGrid(
  viewportW: number, viewportH: number, count: number, opts: GridOpts = {},
): GridLayout {
  const margin = opts.margin ?? 24;
  const gap = opts.gap ?? 18;
  const topReserved = opts.topReserved ?? 120;
  const bottomReserved = opts.bottomReserved ?? 150;
  const minCell = opts.minCell ?? 132;
  const maxCell = opts.maxCell ?? 188;

  const contentW = Math.max(1, viewportW - 2 * margin);
  const contentH = Math.max(1, viewportH - topReserved - bottomReserved);

  const cols = Math.max(1, Math.floor((contentW + gap) / (minCell + gap)));
  const cellSize = Math.min(maxCell, (contentW - (cols - 1) * gap) / cols);
  const rows = Math.max(1, Math.floor((contentH + gap) / (cellSize + gap)));
  const perPage = cols * rows;
  const pages = Math.max(1, Math.ceil(count / perPage));

  const blockW = cols * cellSize + (cols - 1) * gap;
  const blockH = rows * cellSize + (rows - 1) * gap;
  const originX = margin + (contentW - blockW) / 2 + cellSize / 2;
  const originY = topReserved + (contentH - blockH) / 2 + cellSize / 2;

  const cellCenters: GridCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cellCenters.push({ cx: originX + c * (cellSize + gap), cy: originY + r * (cellSize + gap) });
    }
  }
  return { cols, rows, perPage, pages, cellSize, originX, originY, cellCenters };
}

export function pageSlice<T>(items: readonly T[], page: number, perPage: number): T[] {
  return items.slice(page * perPage, page * perPage + perPage);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/core/soundboardLayout.test.ts`
Expected: PASS (8 assertions across the cases).

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests pass (existing 72 + new), tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/soundboardLayout.ts tests/core/soundboardLayout.test.ts
git commit -m "feat(soundboard): pure paged-grid layout math + tests"
```

---

### Task 2: Voice synth build script (`scripts/build-soundboard-audio.mjs`)

**Files:**
- Create: `scripts/build-soundboard-audio.mjs`
- Modify: `package.json` (add script)
- Generated (commit): `public/audio/animalvoices.mp3`, `public/audio/animalvoices.json`

**Interfaces:**
- Produces: `public/audio/animalvoices.mp3` (one MP3, mono 44.1kHz) and `public/audio/animalvoices.json` of shape `{ "resources": ["animalvoices.mp3"], "spritemap": { "<name>": { "start": <sec>, "end": <sec> }, ... } }` with exactly the 53 names from the canonical order.

Mirrors `scripts/build-audio.mjs` (reuse `SAMPLE_RATE`, `CHANNELS`, `BIT_RATE`, `f32ToI16`, `encodeToMp3`).

- [ ] **Step 1: Add the npm script**

Modify `package.json` `scripts` (add after `"gumball-audio"`):
```json
    "soundboard-audio": "node scripts/build-soundboard-audio.mjs",
```

- [ ] **Step 2: Create the build script — header, encoder, DSP helpers**

Create `scripts/build-soundboard-audio.mjs`:
```js
/**
 * build-soundboard-audio.mjs
 * Synthesises ~53 short, distinct, cute creature "voices" for the Animal Soundboard
 * and bakes them into ONE audio sprite: public/audio/animalvoices.mp3 plus a JSON
 * marker map public/audio/animalvoices.json ({resources, spritemap:{name:{start,end}}}).
 * No recorded samples; pure oscillator synthesis. Mirrors scripts/build-audio.mjs.
 * Run: node scripts/build-soundboard-audio.mjs  (or: npm run soundboard-audio)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import lamejs from "@breezystack/lamejs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Mp3Encoder } = lamejs;
const OUT_DIR = path.join(__dirname, "..", "public", "audio");
fs.mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BIT_RATE = 128;
const GAP_SEC = 0.4;          // silence between voices so MP3 tails never bleed

function f32ToI16(v) { const c = Math.max(-1, Math.min(1, v)); return Math.round(c * 32767); }

function encodeToMp3(samples) {
  const enc = new Mp3Encoder(CHANNELS, SAMPLE_RATE, BIT_RATE);
  const BLOCK = 1152;
  const i16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) i16[i] = f32ToI16(samples[i]);
  const chunks = [];
  for (let off = 0; off < i16.length; off += BLOCK) {
    const c = enc.encodeBuffer(i16.subarray(off, off + BLOCK));
    if (c.length > 0) chunks.push(Buffer.from(c));
  }
  const f = enc.flush();
  if (f.length > 0) chunks.push(Buffer.from(f));
  return Buffer.concat(chunks);
}

const ms = (n) => Math.ceil((SAMPLE_RATE * n) / 1000);

// Per-sample frequency curve from [ms, multiplier] anchors, scaled by f0.
// Exponential interpolation; holds the last value to the end.
function contourCurve(f0, anchors, n) {
  const out = new Float32Array(n);
  const pts = anchors.map(([t, mul]) => [ms(t), f0 * mul]);
  for (let i = 0; i < n; i++) {
    let a = pts[0], b = pts[pts.length - 1];
    for (let k = 0; k < pts.length - 1; k++) {
      if (i >= pts[k][0] && i <= pts[k + 1][0]) { a = pts[k]; b = pts[k + 1]; break; }
      if (i > pts[pts.length - 1][0]) { a = b = pts[pts.length - 1]; }
    }
    const span = Math.max(1, b[0] - a[0]);
    const tt = Math.max(0, Math.min(1, (i - a[0]) / span));
    out[i] = a[1] * Math.pow(b[1] / a[1], tt);
  }
  return out;
}

function wave(kind, phase) {
  switch (kind) {
    case "sine": return Math.sin(phase);
    case "square": return Math.sin(phase) >= 0 ? 1 : -1;
    case "triangle": return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case "sawtooth":
    default: { const t = (phase / (2 * Math.PI)) % 1; return 2 * (t - Math.floor(t + 0.5)); }
  }
}

// RBJ band-pass biquad applied in place (formant colour).
function bandpass(buf, freq, q) {
  if (!freq) return buf;
  const w0 = (2 * Math.PI * freq) / SAMPLE_RATE, a = Math.sin(w0) / (2 * q), c = Math.cos(w0);
  const b0 = a, b1 = 0, b2 = -a, a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x0 = buf[i];
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0; buf[i] = y0;
  }
  return buf;
}

// Attack / decay-to-sustain / release envelope (all ms), in place.
function applyEnv(buf, aMs, dMs, sustain, rMs) {
  const n = buf.length, a = ms(aMs), d = ms(dMs), r = ms(rMs), relStart = Math.max(a + d, n - r);
  for (let i = 0; i < n; i++) {
    let e;
    if (i < a) e = i / Math.max(1, a);
    else if (i < a + d) e = 1 - (1 - sustain) * ((i - a) / Math.max(1, d));
    else if (i < relStart) e = sustain;
    else e = sustain * Math.max(0, 1 - (i - relStart) / Math.max(1, r));
    buf[i] *= e;
  }
  return buf;
}

function peakNormalize(buf, target = 0.7) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  if (peak > 0) { const g = target / peak; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}

let _seed = 1234567;
function rand() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }
```

- [ ] **Step 3: Add the core `synth()` function**

Append to `scripts/build-soundboard-audio.mjs`:
```js
// Synthesise one voice from a fully-resolved parameter object → Float32 samples.
function synth(p) {
  const n = ms(p.durationMs);
  const freq = contourCurve(p.f0, p.contour, n);
  const out = new Float32Array(n);
  let cph = 0, mph = 0;           // carrier + FM-modulator phase accumulators
  for (let i = 0; i < n; i++) {
    let f = freq[i];
    if (p.vibratoDepth) f += Math.sin((2 * Math.PI * p.vibratoRate * i) / SAMPLE_RATE) * p.vibratoDepth;
    cph += (2 * Math.PI * f) / SAMPLE_RATE;
    let s;
    if (p.fmRatio) {
      mph += (2 * Math.PI * f * p.fmRatio) / SAMPLE_RATE;
      s = Math.sin(cph + p.fmIndex * Math.sin(mph));
    } else {
      s = wave(p.waveform, cph);
    }
    if (p.amPulseRate) {
      const lfo = 0.5 + 0.5 * Math.sin((2 * Math.PI * p.amPulseRate * i) / SAMPLE_RATE);
      s *= 0.25 + 0.75 * lfo;
    }
    if (p.noiseAmount) s = s * (1 - p.noiseAmount) + (rand() * 2 - 1) * p.noiseAmount;
    out[i] = s;
  }
  if (p.noiseAmount && p.noiseCutoff) bandpass(out, p.noiseCutoff, 0.9); // tame raw noise a bit
  if (p.formantFreq) bandpass(out, p.formantFreq, p.formantQ ?? 6);
  applyEnv(out, p.attackMs ?? 6, p.decayMs ?? 60, p.sustain ?? 0.7, p.releaseMs ?? 80);
  return peakNormalize(out, 0.7);
}
```

- [ ] **Step 4: Add the archetypes + the 53-creature `VOICES` table**

Append to `scripts/build-soundboard-audio.mjs`:
```js
// Archetype defaults; per-creature entries override f0 (and anything else).
const A = {
  meow:    { waveform: "sine",     contour: [[0, 1], [40, 1.0], [200, 2.1], [480, 0.85]], vibratoRate: 18, vibratoDepth: 12, formantFreq: 1000, formantQ: 8, durationMs: 520, attackMs: 8, decayMs: 120, sustain: 0.6, releaseMs: 160 },
  bark:    { waveform: "sawtooth", contour: [[0, 1.8], [60, 1.0], [120, 0.7], [140, 1.7], [220, 0.8]], formantFreq: 700, formantQ: 4, durationMs: 240, attackMs: 3, decayMs: 60, sustain: 0.5, releaseMs: 40 },
  moo:     { waveform: "sawtooth", contour: [[0, 1.05], [120, 1.0], [600, 0.8]], vibratoRate: 6, vibratoDepth: 6, formantFreq: 320, formantQ: 5, durationMs: 700, attackMs: 25, decayMs: 120, sustain: 0.8, releaseMs: 160 },
  squeak:  { waveform: "sine",     contour: [[0, 1], [60, 1.6], [160, 1.0]], vibratoRate: 22, vibratoDepth: 30, durationMs: 220, attackMs: 4, decayMs: 40, sustain: 0.5, releaseMs: 60 },
  chirp:   { waveform: "sine",     contour: [[0, 1], [50, 2.4], [110, 1.2]], durationMs: 180, attackMs: 3, decayMs: 30, sustain: 0.4, releaseMs: 40, noiseAmount: 0.06, noiseCutoff: 4000 },
  coo:     { waveform: "sine",     contour: [[0, 1], [120, 1.15], [320, 0.95]], vibratoRate: 7, vibratoDepth: 10, formantFreq: 700, formantQ: 6, durationMs: 360, attackMs: 20, decayMs: 120, sustain: 0.7, releaseMs: 120 },
  ribbit:  { waveform: "sawtooth", contour: [[0, 1], [300, 1.0]], amPulseRate: 34, formantFreq: 950, formantQ: 7, durationMs: 320, attackMs: 4, decayMs: 60, sustain: 0.8, releaseMs: 60 },
  buzz:    { waveform: "sawtooth", contour: [[0, 1], [300, 1.0]], amPulseRate: 60, formantFreq: 1500, formantQ: 3, durationMs: 300, attackMs: 6, decayMs: 60, sustain: 0.7, releaseMs: 60 },
  hiss:    { waveform: "sine",     contour: [[0, 1.1], [300, 0.9]], noiseAmount: 0.85, noiseCutoff: 3500, durationMs: 360, attackMs: 10, decayMs: 120, sustain: 0.6, releaseMs: 120 },
  honk:    { waveform: "sawtooth", contour: [[0, 1.2], [80, 1.0], [260, 0.85]], vibratoRate: 10, vibratoDepth: 14, formantFreq: 600, formantQ: 5, durationMs: 340, attackMs: 8, decayMs: 80, sustain: 0.7, releaseMs: 90 },
  burble:  { waveform: "sine",     contour: [[0, 0.9], [120, 1.2], [300, 0.85]], amPulseRate: 14, formantFreq: 500, formantQ: 4, durationMs: 360, attackMs: 10, decayMs: 80, sustain: 0.7, releaseMs: 90, noiseAmount: 0.05, noiseCutoff: 1200 },
  robot:   { waveform: "square",   contour: [[0, 1], [300, 1.0]], fmRatio: 1.4, fmIndex: 6, amPulseRate: 16, durationMs: 360, attackMs: 4, decayMs: 40, sustain: 0.8, releaseMs: 60 },
  alien:   { waveform: "sine",     contour: [[0, 0.7], [120, 1.8], [240, 0.9], [400, 1.5]], fmRatio: 2.5, fmIndex: 5, vibratoRate: 26, vibratoDepth: 40, durationMs: 460, attackMs: 6, decayMs: 60, sustain: 0.7, releaseMs: 80 },
  ghost:   { waveform: "sine",     contour: [[0, 0.95], [250, 1.1], [600, 0.9]], vibratoRate: 3.2, vibratoDepth: 26, formantFreq: 900, formantQ: 9, durationMs: 640, attackMs: 60, decayMs: 160, sustain: 0.7, releaseMs: 220 },
  poop:    { waveform: "sawtooth", contour: [[0, 1.4], [320, 0.6]], amPulseRate: 22, formantFreq: 500, formantQ: 4, durationMs: 360, attackMs: 6, decayMs: 80, sustain: 0.7, releaseMs: 90 },
  unicorn: { waveform: "sine",     contour: [[0, 1], [120, 1.6], [280, 2.2], [520, 2.0]], vibratoRate: 9, vibratoDepth: 8, durationMs: 620, attackMs: 8, decayMs: 120, sustain: 0.7, releaseMs: 220 },
};

// [name, archetype, f0, durationMs?] — order IS the canonical order. 53 entries.
const VOICES = [
  ["cat", "meow", 330], ["dog", "bark", 220], ["rabbit", "squeak", 720], ["chipmunk", "squeak", 1000], ["rat", "squeak", 900],
  ["cow", "moo", 110], ["pig", "honk", 240, 280], ["horse", "honk", 360], ["goat", "honk", 320, 300], ["ox", "moo", 95], ["chick", "chirp", 1300], ["rooster", "chirp", 520, 380],
  ["fox", "bark", 300], ["bear", "moo", 150], ["panda", "burble", 260], ["lion", "moo", 180, 720], ["tiger", "moo", 170, 640], ["sloth", "coo", 230], ["raccoon", "buzz", 520], ["hedgehog", "squeak", 760], ["kangaroo", "honk", 300],
  ["monkey", "buzz", 420], ["gorilla", "moo", 120], ["orangutan", "moo", 175],
  ["octopus", "burble", 300], ["turtle", "burble", 240], ["whale", "moo", 90, 760], ["crab", "buzz", 600], ["penguin", "honk", 360], ["otter", "squeak", 640], ["seal", "honk", 300], ["lobster", "buzz", 520], ["jellyfish", "burble", 360],
  ["owl", "coo", 360], ["peacock", "chirp", 700, 260], ["eagle", "chirp", 900, 220], ["flamingo", "honk", 560], ["dove", "coo", 480],
  ["frog", "ribbit", 250], ["snake", "hiss", 320], ["lizard", "hiss", 380, 240],
  ["butterfly", "buzz", 320, 220], ["snail", "burble", 200], ["ant", "buzz", 360], ["donut", "buzz", 340], ["microbe", "alien", 420, 300],
  ["trex", "moo", 100, 760], ["sauropod", "moo", 92, 760],
  ["robot", "robot", 240], ["alien", "alien", 360], ["ghost", "ghost", 300], ["poop", "poop", 260], ["unicorn", "unicorn", 600],
];
```

- [ ] **Step 5: Add the bake loop (concat + markers + encode + write)**

Append to `scripts/build-soundboard-audio.mjs`:
```js
function main() {
  const gapN = ms(GAP_SEC * 1000);
  const segments = [];
  const spritemap = {};
  let cursor = 0; // samples
  for (const [name, arch, f0, durationMs] of VOICES) {
    const base = A[arch];
    if (!base) throw new Error(`unknown archetype ${arch} for ${name}`);
    const p = { ...base, f0, ...(durationMs ? { durationMs } : {}) };
    const buf = synth(p);
    const start = cursor / SAMPLE_RATE;
    const end = (cursor + buf.length) / SAMPLE_RATE;
    spritemap[name] = { start: +start.toFixed(4), end: +end.toFixed(4) };
    segments.push(buf);
    cursor += buf.length + gapN; // trailing silence gap after each voice
  }
  const total = new Float32Array(cursor);
  let pos = 0;
  for (const seg of segments) { total.set(seg, pos); pos += seg.length + gapN; }

  const mp3 = encodeToMp3(total);
  fs.writeFileSync(path.join(OUT_DIR, "animalvoices.mp3"), mp3);
  fs.writeFileSync(
    path.join(OUT_DIR, "animalvoices.json"),
    JSON.stringify({ resources: ["animalvoices.mp3"], spritemap }, null, 2),
  );
  console.log(`animalvoices.mp3 → ${Math.round(mp3.length / 1024)}KB, ${Object.keys(spritemap).length} markers`);
}
main();
```

- [ ] **Step 6: Generate the assets and verify**

Run: `npm run soundboard-audio`
Expected: prints `animalvoices.mp3 → <NNN>KB, 53 markers`.

Run: `node -e "const j=require('./public/audio/animalvoices.json'); const n=Object.keys(j.spritemap); if(n.length!==53) throw new Error('want 53, got '+n.length); if(!n.includes('unicorn')||!n.includes('donut')) throw new Error('missing names'); let last=0; for(const k of n){const m=j.spritemap[k]; if(m.start<last-0.001) throw new Error('overlap '+k); if(m.end<=m.start) throw new Error('bad span '+k); last=m.end;} console.log('JSON OK: 53 ordered, non-overlapping markers');"`
Expected: `JSON OK: 53 ordered, non-overlapping markers`.

Run: `ls -la public/audio/animalvoices.mp3` — expected a few hundred KB (sane, non-empty).

- [ ] **Step 7: Commit**

```bash
git add scripts/build-soundboard-audio.mjs package.json public/audio/animalvoices.mp3 public/audio/animalvoices.json
git commit -m "feat(soundboard): synth voices baked into one MP3 audio sprite + JSON"
```

---

### Task 3: Audio wiring — BootScene load + `Sound.voice()`

**Files:**
- Modify: `src/scenes/BootScene.ts:25` (after the `tada` audio load)
- Modify: `src/audio/sound.ts`

**Interfaces:**
- Consumes: the `"animalvoices"` audio sprite (Task 2), `core` nothing.
- Produces: `Sound.voice(marker: string, volume?: number): void` (cut-off-previous).

- [ ] **Step 1: Load the audio sprite in BootScene**

In `src/scenes/BootScene.ts`, after the line `this.load.audio("tada", ["audio/tada.mp3"]);`, add:
```ts
    this.load.audioSprite("animalvoices", "audio/animalvoices.json", ["audio/animalvoices.mp3"]);
```

- [ ] **Step 2: Add the `voice()` method to Sound**

In `src/audio/sound.ts`, add a private field after `private _playlist...` and the method after `tada()`:
```ts
  private _voices?: Phaser.Sound.BaseSound; // retained audiosprite instance (cut-off-previous)

  // Play one creature voice from the baked audio sprite; stops any voice already
  // playing so the latest tap always wins (no pile-up on rapid tapping).
  voice(marker: string, volume = 0.7): void {
    if (!this._voices) this._voices = this.scene.sound.addAudioSprite("animalvoices");
    this._voices.stop();
    (this._voices as Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound).play(marker, { volume });
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (If Phaser's `BaseSound.play` typing rejects the marker+config overload, the cast in the snippet covers both Web Audio and HTML5 audio sound types.)

- [ ] **Step 4: Smoke-test the audiosprite JSON shape in the running app**

Run: `npm run dev` and, via the Claude Preview MCP, with the app loaded, eval:
```js
(() => { const g = window.__game; const s = g.scene.getScene('Title');
  const a = s.sound.addAudioSprite('animalvoices');
  const ok = !!a && typeof a.play === 'function';
  a.play('cat'); return { ok, markers: Object.keys(g.cache.json.get('animalvoices')?.spritemap || g.cache.audioSprite?.get?.('animalvoices') || {}).length }; })()
```
Expected: `{ ok: true, ... }` and the cat voice is audible / no console error.
**If Phaser logs "Audio marker not found" or the JSON didn't register:** Phaser 4 expects `duration` rather than `end` in some builds — change the build script (Task 2, Step 5) to emit `{ start, duration: end - start }` instead of `{ start, end }`, re-run `npm run soundboard-audio`, and re-test. Document whichever shape worked.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/BootScene.ts src/audio/sound.ts
git commit -m "feat(soundboard): load voice audio sprite + Sound.voice() cut-off-previous"
```

---

### Task 4: SoundboardScene

**Files:**
- Create: `src/scenes/SoundboardScene.ts`

**Interfaces:**
- Consumes: `computeGrid`, `pageSlice` (Task 1); `Sound.voice` (Task 3); `Celebrations.popAt`; `EMOJI` from `../render/emoji`; `CATCH_UNICORN_KEY`, `CATCH_UNICORN_ANIM` from `../render/catchUnicorn`; `PlayroomBackground`.
- Produces: a Phaser scene registered under key `"Soundboard"`.

- [ ] **Step 1: Create the scene**

Create `src/scenes/SoundboardScene.ts`:
```ts
import Phaser from "phaser";
import { PlayroomBackground } from "./ui/PlayroomBackground";
import { Sound } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { EMOJI } from "../render/emoji";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM } from "../render/catchUnicorn";
import { computeGrid, pageSlice, type GridLayout } from "../core/soundboardLayout";

// Canonical order: 52 emoji creatures + the unicorn (rendered from the catchUnicorn
// sheet). Each name is also the audio-sprite marker. `donut` is the ladybug glyph.
const SOUNDBOARD_ORDER: readonly string[] = [
  "cat", "dog", "rabbit", "chipmunk", "rat",
  "cow", "pig", "horse", "goat", "ox", "chick", "rooster",
  "fox", "bear", "panda", "lion", "tiger", "sloth", "raccoon", "hedgehog", "kangaroo",
  "monkey", "gorilla", "orangutan",
  "octopus", "turtle", "whale", "crab", "penguin", "otter", "seal", "lobster", "jellyfish",
  "owl", "peacock", "eagle", "flamingo", "dove",
  "frog", "snake", "lizard",
  "butterfly", "snail", "ant", "donut", "microbe",
  "trex", "sauropod",
  "robot", "alien", "ghost", "poop", "unicorn",
];

const SWIPE_MIN = 60;   // px horizontal travel to count as a page swipe
const TAP_MAX = 18;     // px travel under which a press counts as a tap

export class SoundboardScene extends Phaser.Scene {
  private bg!: PlayroomBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private grid!: GridLayout;
  private page = 0;
  private pageLayer!: Phaser.GameObjects.Container; // holds the current page's buttons
  private arrows: Phaser.GameObjects.Text[] = [];
  private dots: Phaser.GameObjects.Arc[] = [];

  constructor() { super("Soundboard"); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.bg = new PlayroomBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.fx = new Celebrations(this);
    this.page = 0;

    this.grid = computeGrid(W, H, SOUNDBOARD_ORDER.length);
    this.pageLayer = this.add.container(0, 0);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sound.stopAll());

    // Back to title (top-right), like the other modes.
    this.add.text(W - 24, 24, "⬅", { fontSize: "44px", color: "#5a3b8c" })
      .setOrigin(1, 0).setDepth(1000).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("Title"));

    // Horizontal swipe to flip pages (tap vs swipe disambiguated by travel).
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const dx = p.upX - p.downX, dy = p.upY - p.downY;
      if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
        this.gotoPage(this.page + (dx < 0 ? 1 : -1));
      }
    });

    this.buildArrowsAndDots(W, H);
    this.renderPage();
  }

  private gotoPage(next: number) {
    const clamped = Phaser.Math.Clamp(next, 0, this.grid.pages - 1);
    if (clamped === this.page) return;
    this.page = clamped;
    this.renderPage();
  }

  private renderPage() {
    this.pageLayer.removeAll(true); // destroy previous page's buttons
    const names = pageSlice(SOUNDBOARD_ORDER, this.page, this.grid.perPage);
    names.forEach((name, i) => {
      const { cx, cy } = this.grid.cellCenters[i];
      this.makeButton(name, cx, cy, this.grid.cellSize);
    });
    // Arrow visibility + dot highlight.
    this.arrows[0].setVisible(this.page > 0);
    this.arrows[1].setVisible(this.page < this.grid.pages - 1);
    this.dots.forEach((d, i) => d.setFillStyle(i === this.page ? 0x5a3b8c : 0xcdbcdc));
  }

  private makeButton(name: string, cx: number, cy: number, cell: number) {
    const card = this.add.graphics();
    card.fillStyle(0xffffff, 0.85).fillRoundedRect(cx - cell / 2, cy - cell / 2, cell, cell, 26);
    this.pageLayer.add(card);

    const isUni = name === "unicorn";
    const texKey = isUni ? CATCH_UNICORN_KEY : EMOJI[name].key;
    const frameH = isUni ? 256 : EMOJI[name].frameHeight; // 256 / 144
    const spr = this.add.sprite(cx, cy, texKey).setFrame(0); // static idle
    spr.setScale((cell * 0.62) / frameH);
    this.pageLayer.add(spr);

    const zone = this.add.zone(cx, cy, cell + 20, cell + 20).setInteractive({ useHandCursor: true });
    this.pageLayer.add(zone);
    zone.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY) > TAP_MAX) return; // was a swipe
      this.tap(name, spr, isUni, cx, cy);
    });
  }

  private tap(name: string, spr: Phaser.GameObjects.Sprite, isUni: boolean, cx: number, cy: number) {
    this.sound2.voice(name);
    this.fx.popAt(cx, cy);
    const baseScale = spr.scaleX;
    this.tweens.killTweensOf(spr);
    this.tweens.add({
      targets: spr, scaleX: baseScale * 1.18, scaleY: baseScale * 0.86,
      duration: 90, yoyo: true, ease: "Sine.inOut",
      onComplete: () => spr.setScale(baseScale),
    });
    // Briefly bring the creature to life, then settle back to the static frame.
    spr.play(isUni ? CATCH_UNICORN_ANIM : EMOJI[name].anim);
    this.time.delayedCall(800, () => { if (spr.active) { spr.anims.stop(); spr.setFrame(0); } });
  }

  private buildArrowsAndDots(W: number, H: number) {
    const y = H - 80;
    const left = this.add.text(60, y, "◀", { fontSize: "64px", color: "#5a3b8c" })
      .setOrigin(0.5).setDepth(900).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.gotoPage(this.page - 1));
    const right = this.add.text(W - 60, y, "▶", { fontSize: "64px", color: "#5a3b8c" })
      .setOrigin(0.5).setDepth(900).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.gotoPage(this.page + 1));
    this.arrows = [left, right];
    const gap = 30, x0 = W / 2 - ((this.grid.pages - 1) * gap) / 2;
    for (let i = 0; i < this.grid.pages; i++) {
      this.dots.push(this.add.circle(x0 + i * gap, y, 8, 0xcdbcdc).setDepth(900));
    }
  }

  update(_t: number, dms: number) {
    this.bg.update(dms / 1000, this.scale.width);
  }
}
```

NOTE: in `renderPage`, set the inactive-dot colour with the literal `0xcdbcdc` (replace the placeholder expression shown above): `this.dots.forEach((d, i) => d.setFillStyle(i === this.page ? 0x5a3b8c : 0xcdbcdc));`

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (Ensure the dot-colour line uses the `0xcdbcdc` literal, no stray characters; no unused imports/locals.)

- [ ] **Step 3: Commit** (scene compiles; it is wired into the app in Task 5)

```bash
git add src/scenes/SoundboardScene.ts
git commit -m "feat(soundboard): SoundboardScene — paged grid, tap voice + bounce + sparkle"
```

---

### Task 5: Register scene + title button

**Files:**
- Modify: `src/main.ts`
- Modify: `src/scenes/TitleScene.ts`

**Interfaces:**
- Consumes: `SoundboardScene` (Task 4).

- [ ] **Step 1: Register the scene**

In `src/main.ts`, import and add to the scene list:
```ts
import { SoundboardScene } from "./scenes/SoundboardScene";
```
and change the `scene:` array to:
```ts
  scene: [BootScene, TitleScene, GameScene, CatchScene, PopScene, GumballScene, SoundboardScene],
```

- [ ] **Step 2: Compress the title layout + add the 5th button**

In `src/scenes/TitleScene.ts`:
- Move the hero unicorn up and slightly smaller: change
  `const uni = this.add.sprite(W / 2, 430, CATCH_UNICORN_KEY).setScale(0.8)...` to `... (W / 2, 380, CATCH_UNICORN_KEY).setScale(0.7)...`
  and its tween target `y: 400` → `y: 350`.
- Replace the four `makeButton(...)` calls with five at the tighter spacing:
```ts
    this.makeButton(W / 2, 630, "🌈", "Rainbow Shoot", 0x9b6bff, () => this.go("Game"));
    this.makeButton(W / 2, 748, "🌈", "Rainbow Catch", 0x7ed957, () => this.go("Catch"));
    this.makeButton(W / 2, 866, "🫧", "Pop the Cuties", 0xff5fa2, () => this.go("Pop"));
    this.makeButton(W / 2, 984, "🎁", "Unicorn Gumballs", 0xff9f43, () => this.go("Gumball"));
    this.makeButton(W / 2, 1102, "🔊", "Animal Sounds", 0x00b4d8, () => this.go("Soundboard"));
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc clean; Vite build succeeds.

- [ ] **Step 4: Preview-verify the full flow**

Run `npm run dev`; via the Claude Preview MCP load the app, tap **Animal Sounds**, and eval to confirm the scene is active and the grid built:
```js
(() => { const g = window.__game; g.scene.start('Soundboard');
  const s = g.scene.getScene('Soundboard');
  return { active: s.scene.isActive(), pages: s.grid.pages, perPage: s.grid.perPage }; })()
```
Expected: `{ active: true, pages: >=1, perPage: >0 }`. Spot-check by tapping a few creatures (incl. the unicorn) — each plays a distinct voice + bounce + sparkle; arrows/swipe change pages.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/scenes/TitleScene.ts
git commit -m "feat(soundboard): register scene + title button (compressed 5-button layout)"
```

---

### Task 6: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean; all tests pass (existing 72 + new `soundboardLayout` tests); Vite build + PWA succeed.

- [ ] **Step 2: Asset sanity**

Run: `node -e "const j=require('./public/audio/animalvoices.json'); console.log(Object.keys(j.spritemap).length + ' markers');"`
Expected: `53 markers`. Confirm `public/audio/animalvoices.mp3` exists and is non-trivial in size.

- [ ] **Step 3: Preview smoke** (if not already done in Task 5)

Load the app, enter Animal Sounds, tap several creatures across pages incl. the unicorn — distinct voices, bounce, sparkle, paging all work; returning to Title and re-entering works.

- [ ] **Step 4: No commit needed** (verification only). If any fix was required, commit it with a `fix(soundboard): ...` message.

---

## Self-Review

**Spec coverage:**
- 53-button scope + exact creature set/order → Task 4 `SOUNDBOARD_ORDER`, Task 2 `VOICES` (Global Constraints list).
- Paged responsive grid, max density → Task 1 `computeGrid` (+ tests), Task 4 rendering.
- Static idle / animate-on-tap, bounce, sparkle, cut-off-previous → Task 4 `tap()`, Task 3 `voice()`.
- Synth voices (hybrid recognizable-cute) baked into one MP3 sprite + JSON, mirroring `build-audio.mjs` → Task 2.
- One BootScene fetch → Task 3 Step 1.
- Title 5th button (compressed) → Task 5.
- `main.ts` registration, `package.json` script → Tasks 5 / 2.
- No calm mode, no new graphics, core import-purity → honored (scene holds the render-keyed order; `core/` only does math).

**Placeholder scan:** The only non-literal in the code is the dot-colour expression in `renderPage`, explicitly corrected to the `0xcdbcdc` literal in Task 4 Step 1's NOTE and Step 2's check. Per-creature synth params are all concrete (archetype + f0). No TBDs.

**Type consistency:** `computeGrid`/`pageSlice`/`GridLayout` names match across Tasks 1 and 4; `Sound.voice(marker, volume?)` matches Tasks 3 and 4; audio-sprite key `"animalvoices"` matches Tasks 2/3/4; marker names (incl. `donut`, `unicorn`) match between Task 2 `VOICES` and Task 4 `SOUNDBOARD_ORDER`.

**Known follow-up (not blockers):** per-creature voice params are seeded from archetypes and may want ear-tuning (esp. the fantasy voices); the audiosprite JSON `end` vs `duration` field is verified live in Task 3 Step 4 with a documented fallback.
