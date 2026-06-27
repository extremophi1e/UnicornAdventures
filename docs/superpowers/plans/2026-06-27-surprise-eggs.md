# Surprise Eggs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth game mode, "Surprise Eggs" — 4 pastel eggs wobble in a barnyard nest; the child cracks each open with 3 forgiving taps to reveal a random animal with a fanfare; a rare golden egg hatches the unicorn jackpot.

**Architecture:** A pure, Vitest-tested `src/core/eggs.ts` owns the only new rule (the 3-tap crack FSM); everything else reuses already-tested core (`createBag` picker from `gumballs.ts`, `pickNearestWithinRadius` from `pop.ts`). A thin `EggsScene` renders 4 fixed per-slot egg views (shape-drawn `Graphics`, redraw cracks), dispatches multi-touch taps scene-level to the nearest egg, and runs the hatch → reveal → fade → refill loop with one pooled shatter emitter. A shape-drawn `EggsBackground` and offline-synthesized crack/shatter SFX + a swappable music track complete it.

**Tech Stack:** Phaser 4 + TypeScript + Vite (existing). Vitest for pure-logic tests. `@breezystack/lamejs` (existing dev dep) for offline SFX synthesis. No new runtime deps, no image assets.

**Spec:** [docs/superpowers/specs/2026-06-27-surprise-eggs-design.md](../specs/2026-06-27-surprise-eggs-design.md)
**Research brief:** [docs/superpowers/research/2026-06-27-surprise-eggs-brief.md](../research/2026-06-27-surprise-eggs-brief.md)

## Global Constraints

(Every task's requirements implicitly include these — copied from the spec.)

- **No-fail, no game-over, no score/HUD** except a ⬅ back button.
- **3 taps to hatch**, each tap = a concrete distinct crack stage drawn on the egg (never an abstract meter); the burst always lands on the 3rd tap.
- **Forgiving touch:** hit area larger than the visible egg; register on **pointer-down**; **multi-touch** (`input.addPointer(3)`).
- **No separate calm mode.** **Photosensitivity-safe by construction:** no rapid strobe; no camera shake in the reduced-motion path; golden cue stays slow and avoids saturated red. A **reduced-motion** path honours `prefers-reduced-motion`.
- **`src/core/` stays import-pure** (no Phaser / `render` imports), Vitest-tested; rendering + all timing/animation live in the scene. **No `Date.now()` / `Math.random()` in `src/core/`** (inject rng).
- TypeScript strict with `noUnusedLocals` + `noUnusedParameters` — no unused imports/params.
- On-screen emoji size rule: displayed px = `setScale × 144`.
- Scene key is `"Eggs"`. Title button: 🥚 **Surprise Eggs**, colour `0xb39ddb`.

---

### Task 1: Pure crack FSM — `src/core/eggs.ts` (+ tests)

**Files:**
- Create: `src/core/eggs.ts`
- Test: `tests/core/eggs.test.ts`

**Interfaces:**
- Consumes: nothing (pure, leaf module).
- Produces:
  - `type Stage = "intact" | "crack1" | "crack2" | "burst"`
  - `function nextStage(stage: Stage): Stage` — advance one crack stage; `burst` is terminal/idempotent.
  - `function isHatched(stage: Stage): boolean` — `stage === "burst"`.
  - `const TAPS_TO_HATCH = 3`, `const CLUTCH_SIZE = 4`.

- [ ] **Step 1: Write the failing test**

Create `tests/core/eggs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextStage, isHatched, TAPS_TO_HATCH, CLUTCH_SIZE, type Stage } from "../../src/core/eggs";

describe("eggs core — crack FSM", () => {
  it("walks intact -> crack1 -> crack2 -> burst", () => {
    expect(nextStage("intact")).toBe("crack1");
    expect(nextStage("crack1")).toBe("crack2");
    expect(nextStage("crack2")).toBe("burst");
  });

  it("burst is terminal (idempotent) — extra/simultaneous taps are safe", () => {
    expect(nextStage("burst")).toBe("burst");
  });

  it("reaches burst in exactly TAPS_TO_HATCH taps, not before", () => {
    let stage: Stage = "intact";
    for (let i = 0; i < TAPS_TO_HATCH - 1; i++) stage = nextStage(stage);
    expect(stage).toBe("crack2");        // still cracking at TAPS-1
    expect(isHatched(stage)).toBe(false);
    stage = nextStage(stage);            // the 3rd tap
    expect(stage).toBe("burst");
    expect(isHatched(stage)).toBe(true);
  });

  it("isHatched is true only for burst", () => {
    expect(isHatched("intact")).toBe(false);
    expect(isHatched("crack1")).toBe(false);
    expect(isHatched("crack2")).toBe(false);
    expect(isHatched("burst")).toBe(true);
  });

  it("constants are the values the scene + copy rely on", () => {
    expect(TAPS_TO_HATCH).toBe(3);
    expect(CLUTCH_SIZE).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/eggs.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/eggs'` (or "nextStage is not a function").

- [ ] **Step 3: Write the implementation**

Create `src/core/eggs.ts`:

```ts
// Pure, framework-free crack FSM for Surprise Eggs. No Phaser / render imports;
// unit-tested headlessly. The egg advances one stage per tap; contents and the
// nearest-tap hit-test are reused from gumballs.ts / pop.ts in the scene.

// intact --tap--> crack1 --tap--> crack2 --tap--> burst.
export type Stage = "intact" | "crack1" | "crack2" | "burst";

export const TAPS_TO_HATCH = 3; // taps from intact to burst
export const CLUTCH_SIZE = 4;   // eggs visible at once (one per nest slot)

const ORDER: readonly Stage[] = ["intact", "crack1", "crack2", "burst"];

// Advance one crack stage on a tap. `burst` is terminal (idempotent), so a stray
// or simultaneous extra tap on an already-hatched egg is a harmless no-op.
export function nextStage(stage: Stage): Stage {
  const i = ORDER.indexOf(stage);
  return i < 0 || i >= ORDER.length - 1 ? "burst" : ORDER[i + 1];
}

// True once the egg has fully hatched (reached burst).
export function isHatched(stage: Stage): boolean {
  return stage === "burst";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/eggs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/eggs.ts tests/core/eggs.test.ts
git commit -m "feat(eggs): pure 3-tap crack FSM + tests"
```

---

### Task 2: Audio — crack/shatter SFX + music + Sound/Boot wiring

**Files:**
- Create: `scripts/build-eggs-audio.mjs`
- Modify: `package.json` (add `eggs-audio` script)
- Modify: `src/audio/sound.ts` (add `crack()` + `shatter()`)
- Modify: `src/scenes/BootScene.ts:10-26` (preload the 5 new audio keys)
- Generated (commit): `public/audio/crack1.mp3`, `crack2.mp3`, `crack3.mp3`, `shatter.mp3`, `eggsmusic.mp3`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (used by Task 4):
  - `Sound.crack(stage: number): void` — plays `crack1|2|3` (clamped to 1..3).
  - `Sound.shatter(): void` — plays `shatter`.
  - Loaded audio keys: `crack1`, `crack2`, `crack3`, `shatter`, `eggsmusic`.

- [ ] **Step 1: Write the audio build script**

Create `scripts/build-eggs-audio.mjs`:

```js
/**
 * build-eggs-audio.mjs
 * Synthesises crack/shatter SFX for Surprise Eggs and downloads a default CC-BY
 * music loop. Outputs to public/audio/.
 *   SFX (synth):   crack1.mp3, crack2.mp3, crack3.mp3, shatter.mp3
 *   Music (fetch): eggsmusic.mp3  (user-swappable; keep the filename)
 * Run: node scripts/build-eggs-audio.mjs   (npm run eggs-audio)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import lamejs from "@breezystack/lamejs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Mp3Encoder } = lamejs;
const OUT_DIR = path.join(__dirname, "..", "public", "audio");
fs.mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE_RATE = 44100, CHANNELS = 1, BIT_RATE = 128;

function f32ToI16(v) { const c = Math.max(-1, Math.min(1, v)); return Math.round(c * 32767); }
function encodeToMp3(samples) {
  const enc = new Mp3Encoder(CHANNELS, SAMPLE_RATE, BIT_RATE);
  const BLOCK = 1152;
  const i16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) i16[i] = f32ToI16(samples[i]);
  const chunks = [];
  for (let o = 0; o < i16.length; o += BLOCK) {
    const c = enc.encodeBuffer(i16.subarray(o, o + BLOCK));
    if (c.length > 0) chunks.push(Buffer.from(c));
  }
  const fl = enc.flush(); if (fl.length > 0) chunks.push(Buffer.from(fl));
  return Buffer.concat(chunks);
}
function write(name, samples) {
  const mp3 = encodeToMp3(samples);
  fs.writeFileSync(path.join(OUT_DIR, name), mp3);
  console.log(`${name}  → ${mp3.length} bytes`);
}

// White noise in [-1,1].
function noise(duration, amp = 1) {
  const n = Math.ceil(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * (Math.random() * 2 - 1);
  return out;
}
function sine(freq, duration, amp = 0.5) {
  const n = Math.ceil(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE));
  return out;
}
// Exponential decay across the buffer (k larger = snappier).
function decay(samples, k = 18) {
  const n = samples.length;
  for (let i = 0; i < n; i++) samples[i] *= Math.exp(-k * (i / n));
  return samples;
}
function mix(a, b) {
  const len = Math.max(a.length, b.length);
  const out = new Float32Array(len);
  for (let i = 0; i < a.length; i++) out[i] += a[i];
  for (let i = 0; i < b.length; i++) out[i] += b[i];
  return out;
}
// A short "tok": a sharp noise transient blended with a pitched body. Rising
// `pitch` across crack1/2/3 makes the three taps climb.
function tok(pitch) {
  const dur = 0.05;
  return mix(decay(noise(dur, 0.5), 26), decay(sine(pitch, dur, 0.5), 22));
}

write("crack1.mp3", tok(420));
write("crack2.mp3", tok(560));
write("crack3.mp3", tok(720));
// Shatter: a longer noise burst + a little low body.
write("shatter.mp3", mix(decay(noise(0.18, 0.7), 12), decay(sine(300, 0.18, 0.3), 10)));

// ---- music download (user-swappable) -----------------------------------
const TRACK = {
  file: "eggsmusic.mp3",
  title: "Fluffing a Duck",
  url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fluffing%20a%20Duck.mp3",
};
function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume(); download(res.headers.location, dest, redirects + 1).then(resolve, reject); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", (e) => { try { fs.unlinkSync(dest); } catch {} reject(e); });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
  });
}
process.stdout.write(`Downloading ${TRACK.title} -> ${TRACK.file} ... `);
download(TRACK.url, path.join(OUT_DIR, TRACK.file))
  .then(() => console.log("ok"))
  .catch((e) => console.error(`FAILED: ${e.message} — pick another gentle CC-BY track, update the URL + CREDITS.md`));
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to the `"scripts"` block (next to the other audio scripts):

```json
"eggs-audio": "node scripts/build-eggs-audio.mjs",
```

- [ ] **Step 3: Run the build script and verify the SFX exist**

Run: `npm run eggs-audio`
Expected: console prints `crack1.mp3 → N bytes` … `shatter.mp3 → N bytes` and a music line (`ok`, or `FAILED:` if offline — the 4 SFX are still written either way).

Verify the four SFX are non-empty (PowerShell):
`Get-ChildItem public/audio/crack1.mp3, public/audio/crack2.mp3, public/audio/crack3.mp3, public/audio/shatter.mp3 | Select-Object Name, Length`
Expected: each `Length` > 0.

(If the music `FAILED` because the runner is offline, that's acceptable — the game tolerates a missing `eggsmusic.mp3` (no crash, just no music). Re-run later online, or swap in your own track.)

- [ ] **Step 4: Add the `Sound` helpers**

In `src/audio/sound.ts`, add these two methods inside the `Sound` class (after `tada()`):

```ts
  // Crack "tok" for tap N (1..3) — rising pitch is baked into the assets.
  crack(stage: number): void {
    const k = ["crack1", "crack2", "crack3"][Math.min(Math.max(stage, 1), 3) - 1];
    this.scene.sound.play(k, { volume: 0.6 });
  }

  // The shell-shatter on the final tap.
  shatter(): void {
    this.scene.sound.play("shatter", { volume: 0.7 });
  }
```

- [ ] **Step 5: Load the new audio in Boot**

In `src/scenes/BootScene.ts`, inside `preload()` after the `this.load.audio("tada", …)` line, add:

```ts
    this.load.audio("crack1", ["audio/crack1.mp3"]);
    this.load.audio("crack2", ["audio/crack2.mp3"]);
    this.load.audio("crack3", ["audio/crack3.mp3"]);
    this.load.audio("shatter", ["audio/shatter.mp3"]);
    this.load.audio("eggsmusic", ["audio/eggsmusic.mp3"]);
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-eggs-audio.mjs package.json src/audio/sound.ts src/scenes/BootScene.ts public/audio/crack1.mp3 public/audio/crack2.mp3 public/audio/crack3.mp3 public/audio/shatter.mp3
git add public/audio/eggsmusic.mp3 2>/dev/null || true
git commit -m "feat(eggs): crack/shatter SFX + music build script, Sound + Boot wiring"
```

---

### Task 3: Barnyard background — `src/scenes/ui/EggsBackground.ts`

**Files:**
- Create: `src/scenes/ui/EggsBackground.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (used by Task 4): `class EggsBackground { constructor(scene: Phaser.Scene, W: number, H: number); update(dt: number, W: number): void }` — the `update` is a no-op (static scene) but kept for call-signature parity with the other backgrounds.

- [ ] **Step 1: Write the background class**

Create `src/scenes/ui/EggsBackground.ts`:

```ts
import Phaser from "phaser";

// Static, shape-drawn barnyard: sky + sun, rolling grass, a red barn + white
// fence, and a big straw nest where the eggs sit. No image assets, no animation
// (keeps the eggs the clear stars). The straw-nest centre is at (W/2, H*0.62) —
// EggsScene positions its 4 eggs around it.
export class EggsBackground {
  constructor(scene: Phaser.Scene, W: number, H: number) {
    const g = scene.add.graphics().setDepth(-10);

    // Sky.
    g.fillGradientStyle(0x8ec9ff, 0x8ec9ff, 0xd8f0ff, 0xd8f0ff, 1);
    g.fillRect(0, 0, W, H * 0.62);

    // Sun (static; soft halo, no strobe).
    g.fillStyle(0xfff8d6, 0.5); g.fillCircle(W * 0.82, H * 0.15, 95);
    g.fillStyle(0xfff3b0, 1); g.fillCircle(W * 0.82, H * 0.15, 70);

    // Grass.
    g.fillGradientStyle(0x9cd67a, 0x9cd67a, 0x6fb24e, 0x6fb24e, 1);
    g.fillRect(0, H * 0.58, W, H * 0.42);

    // Barn.
    const bx = W * 0.22, by = H * 0.58, bw = Math.min(W * 0.26, 190), bh = 150;
    g.fillStyle(0xc0392b, 1); g.fillRect(bx - bw / 2, by - bh, bw, bh);
    g.fillStyle(0x8e2a20, 1);
    g.fillTriangle(bx - bw / 2 - 10, by - bh, bx + bw / 2 + 10, by - bh, bx, by - bh - 56);
    g.fillStyle(0x6b1f18, 1); g.fillRect(bx - 24, by - 70, 48, 70);

    // White picket fence (right of the barn).
    g.fillStyle(0xffffff, 1);
    g.fillRect(W * 0.45, by - 22, W * 0.55, 8);
    for (let fx = W * 0.46; fx < W - 12; fx += 46) g.fillRect(fx, by - 38, 10, 50);

    // Straw nest (woven look: radiating gold/brown strokes + a filled bowl).
    const nx = W / 2, ny = H * 0.62;
    g.fillStyle(0x8a6428, 1); g.fillEllipse(nx, ny + 14, 330, 96);
    g.lineStyle(5, 0xb98a3c, 1);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath();
      g.moveTo(nx + Math.cos(a) * 90, ny + Math.sin(a) * 30);
      g.lineTo(nx + Math.cos(a) * 175, ny + Math.sin(a) * 66);
      g.strokePath();
    }
  }

  // Static background — no per-frame work; method kept for signature parity.
  update(_dt: number, _W: number): void {}
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (note: `EggsBackground` is unused until Task 4 — `tsc --noEmit` does not flag unused *modules*, only unused locals within a file, so this passes).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ui/EggsBackground.ts
git commit -m "feat(eggs): shape-drawn barnyard background"
```

---

### Task 4: The scene — `src/scenes/EggsScene.ts` (+ register in `main.ts`)

**Files:**
- Create: `src/scenes/EggsScene.ts`
- Modify: `src/main.ts:1-24` (import + register `EggsScene`)

**Interfaces:**
- Consumes:
  - `nextStage(stage: Stage): Stage`, `type Stage` — from `src/core/eggs.ts` (Task 1).
  - `Sound.crack(stage: number)`, `Sound.shatter()` — from Task 2; plus existing `fanfare()`, `tada()`.
  - `EggsBackground` — from Task 3.
  - `createBag(rng, items): Bag` + `JACKPOT` — from `src/core/gumballs.ts` (existing).
  - `pickNearestWithinRadius(px, py, targets, radius)` — from `src/core/pop.ts` (existing).
  - `resetEmoji(sprite, type, x, y)` — from `src/render/emojiSprite.ts` (existing).
  - `EMOJI` — from `src/render/emoji.ts` (existing).
  - `Celebrations` (`bigParty`, `popAt`, `banner`), `ATLAS_KEY`, `frameFor`, `CATCH_UNICORN_KEY`, `CATCH_UNICORN_ANIM` — existing.
- Produces: a Phaser scene with key `"Eggs"`.

- [ ] **Step 1: Write the scene**

Create `src/scenes/EggsScene.ts`:

```ts
import Phaser from "phaser";
import { EggsBackground } from "./ui/EggsBackground";
import { resetEmoji } from "../render/emojiSprite";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM } from "../render/catchUnicorn";
import { Sound } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { createBag, JACKPOT, type Bag } from "../core/gumballs";
import { pickNearestWithinRadius } from "../core/pop";
import { nextStage, type Stage } from "../core/eggs";
import { EMOJI } from "../render/emoji";

const EGG_RX = 46, EGG_RY = 60;
const EGG_HIT_RADIUS = 100;
const WOBBLE_DEG = 5, WOBBLE_MS = 550;
const WEB_FLASH_MS = 80;
const REVEAL_HOLD_MS = 2500;
const BURST_PARTICLES = 14;
const ITEM_REVEAL_SCALE = (2.2 / 2) * 1.3;   // 144px emoji frames (/2), shown 30% larger
const JACKPOT_REVEAL_SCALE = 0.85 * 1.3;     // catchUnicorn 256px sheet

// Soft pastel shells (fill + outline/speckle). The golden egg uses GOLD.
const EGG_COLORS = [
  { fill: 0xffd1dc, line: 0xe79bb0 }, // pink
  { fill: 0xbde0fe, line: 0x8bbbe0 }, // sky
  { fill: 0xfff3b0, line: 0xe6d77a }, // butter
  { fill: 0xc8f7d4, line: 0x90d6a6 }, // mint
  { fill: 0xe6dcff, line: 0xb9a7e6 }, // lavender
  { fill: 0xffd8be, line: 0xe6b194 }, // peach
];
const GOLD = { fill: 0xf5c542, line: 0xb8860b };

interface EggView {
  x: number; y: number;                         // nest-slot anchor
  container: Phaser.GameObjects.Container;
  shell: Phaser.GameObjects.Graphics;
  cracks: Phaser.GameObjects.Graphics;
  stage: Stage;
  contents: string;                             // animal key or JACKPOT
  golden: boolean;
  fill: number;
  active: boolean;                              // tappable? (false during drop/reveal/refill)
  wobble?: Phaser.Tweens.Tween;
  breathe?: Phaser.Tweens.Tween;
  sparkle?: Phaser.Time.TimerEvent;
}

export class EggsScene extends Phaser.Scene {
  private bg!: EggsBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bag!: Bag;
  private reduceMotion = false;
  private eggs: EggView[] = [];
  private reveals!: Phaser.GameObjects.Group;   // pooled revealed-animal sprites
  private glow!: Phaser.GameObjects.Rectangle;

  constructor() { super("Eggs"); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.reduceMotion = (typeof window !== "undefined" && window.matchMedia)
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

    this.bg = new EggsBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.fx = new Celebrations(this);
    this.bag = createBag(Math.random, Object.keys(EMOJI)); // one shared bag (global no-repeat + jackpot gate)
    this.eggs = [];

    // One pooled shatter/celebration burst (sparkle frame), shards fall via gravity.
    this.burst = this.add.particles(0, 0, ATLAS_KEY, {
      frame: frameFor("sparkle"), speed: { min: 140, max: 340 }, angle: { min: 0, max: 360 },
      gravityY: 420, scale: { start: 0.7, end: 0 }, alpha: { start: 1, end: 0 },
      lifespan: 600, quantity: 1, emitting: false,
    }).setDepth(60);

    this.glow = this.add.rectangle(W / 2, H / 2, W, H, 0xff7fbf, 0).setDepth(55);
    this.reveals = this.add.group();

    // Four nest slots in a gentle 2x2 cluster around the nest centre (W/2, H*0.62).
    const cx = W / 2, nestY = H * 0.62;
    const dx = Math.min(0.20 * W, 150);
    const anchors = [
      { x: cx - dx, y: nestY - 58 }, { x: cx + dx, y: nestY - 58 },
      { x: cx - dx * 1.05, y: nestY + 64 }, { x: cx + dx * 1.05, y: nestY + 64 },
    ];
    anchors.forEach((a) => this.eggs.push(this.makeEgg(a.x, a.y)));
    this.eggs.forEach((e, i) => this.time.delayedCall(120 * i, () => this.fillEgg(e))); // staggered drop-in

    // Multi-touch: up to 4 fingers; each pointer-down taps the nearest tappable egg.
    this.input.addPointer(3);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onTap(p.worldX, p.worldY));

    // Dedicated looping music, robust autoplay, stopped on shutdown.
    const music = this.sound.add("eggsmusic", { loop: true, volume: 0.38 });
    const startMusic = () => { if (!music.isPlaying) music.play(); };
    startMusic();
    this.time.delayedCall(200, startMusic);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    this.input.once("pointerdown", startMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { music.stop(); this.sound.stopAll(); });

    const back = this.add.text(W - 24, 24, "⬅", { fontSize: "44px", color: "#5a3b8c" })
      .setOrigin(1, 0).setDepth(1000).setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("Title"));
  }

  private makeEgg(x: number, y: number): EggView {
    const shell = this.add.graphics();
    const cracks = this.add.graphics();
    const container = this.add.container(x, y, [shell, cracks]).setDepth(20).setVisible(false);
    return { x, y, container, shell, cracks, stage: "intact", contents: "cat", golden: false, fill: EGG_COLORS[0].fill, active: false };
  }

  // (Re)fill a slot with a fresh egg that drops in from above.
  private fillEgg(e: EggView) {
    e.contents = this.bag.next();
    e.golden = e.contents === JACKPOT;
    const pal = e.golden ? GOLD : EGG_COLORS[Math.floor(Math.random() * EGG_COLORS.length)];
    e.fill = pal.fill;
    e.stage = "intact";
    this.drawEgg(e.shell, pal.fill, pal.line, e.golden);
    e.cracks.clear();
    this.killEggTweens(e);
    e.container.setScale(1).setAngle(0).setAlpha(1).setVisible(true).setPosition(e.x, e.y - 240);
    this.tweens.add({
      targets: e.container, y: e.y, duration: 520, ease: "Bounce.easeOut",
      onComplete: () => { e.active = true; this.startIdle(e); },
    });
  }

  // Wobble (the "tell"), plus a gentle breathe + sparkle for golden eggs.
  private startIdle(e: EggView) {
    if (this.reduceMotion) return;
    e.wobble = this.tweens.add({
      targets: e.container, angle: { from: -WOBBLE_DEG, to: WOBBLE_DEG },
      duration: WOBBLE_MS, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * WOBBLE_MS,
    });
    if (e.golden) {
      e.breathe = this.tweens.add({
        targets: e.container, scale: { from: 1, to: 1.06 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
      e.sparkle = this.time.addEvent({ delay: 700, loop: true, callback: () => { if (e.active) this.twinkle(e.x, e.y - 14); } });
    }
  }

  private twinkle(x: number, y: number) {
    const s = this.add.image(x + (Math.random() * 30 - 15), y, ATLAS_KEY, frameFor("sparkle")).setScale(0.5).setDepth(30);
    this.tweens.add({ targets: s, scale: 0, alpha: 0, duration: 500, onComplete: () => s.destroy() });
  }

  private killEggTweens(e: EggView) {
    e.wobble?.stop(); e.wobble = undefined;
    e.breathe?.stop(); e.breathe = undefined;
    e.sparkle?.remove(false); e.sparkle = undefined;
    this.tweens.killTweensOf(e.container);
  }

  private onTap(px: number, py: number) {
    const tappable = this.eggs.filter((e) => e.active && e.stage !== "burst");
    if (!tappable.length) return;
    const idx = pickNearestWithinRadius(px, py, tappable.map((e) => ({ x: e.x, y: e.y })), EGG_HIT_RADIUS);
    if (idx < 0) return;
    this.tapEgg(tappable[idx]);
  }

  private tapEgg(e: EggView) {
    e.stage = nextStage(e.stage);
    this.tweens.add({ targets: e.container, scaleX: 1.12, scaleY: 0.9, duration: 90, yoyo: true, ease: "Sine.easeInOut" });
    if (e.stage === "burst") {
      e.active = false;
      this.sound2.crack(3);
      this.drawCracks(e.cracks, "burst");      // flash the full web...
      this.killEggTweens(e);
      e.container.setAngle(0).setScale(1);
      this.time.delayedCall(WEB_FLASH_MS, () => this.hatch(e)); // ...then shatter
    } else {
      this.sound2.crack(e.stage === "crack1" ? 1 : 2);
      this.drawCracks(e.cracks, e.stage);
    }
  }

  private hatch(e: EggView) {
    const jackpot = e.contents === JACKPOT;
    this.sound2.shatter();
    if (this.reduceMotion) {
      // Calm path (prefers-reduced-motion): quietly fade the shell out — no flying shards.
      this.tweens.add({ targets: e.container, alpha: 0, duration: 200, onComplete: () => e.container.setVisible(false).setAlpha(1) });
    } else {
      e.container.setVisible(false);
      this.burst.explode(BURST_PARTICLES, e.x, e.y);
    }
    const spr = this.showReveal(e, jackpot);
    const finalScale = jackpot ? JACKPOT_REVEAL_SCALE : ITEM_REVEAL_SCALE;
    this.tweens.add({ targets: spr, y: e.y - 30, duration: 420, ease: "Sine.easeOut" });
    this.tweens.add({ targets: spr, scale: finalScale, duration: 420, ease: "Back.easeOut", onComplete: () => this.payoff(e, jackpot, spr) });
  }

  private showReveal(e: EggView, jackpot: boolean): Phaser.GameObjects.Sprite {
    let s = this.reveals.getFirstDead(false) as Phaser.GameObjects.Sprite | null;
    if (!s) {
      s = this.add.sprite(e.x, e.y, jackpot ? CATCH_UNICORN_KEY : EMOJI[e.contents].key).setDepth(50);
      this.reveals.add(s);
    }
    this.tweens.killTweensOf(s);
    s.setPosition(e.x, e.y).setActive(true).setVisible(true).setAlpha(1).setAngle(0).clearTint();
    if (jackpot) s.play(CATCH_UNICORN_ANIM);
    else resetEmoji(s, e.contents, e.x, e.y);
    s.setScale(0);
    return s;
  }

  private payoff(e: EggView, jackpot: boolean, spr: Phaser.GameObjects.Sprite) {
    if (jackpot) {
      if (this.reduceMotion) this.fx.banner("🌈");
      else {
        this.fx.bigParty(); this.fx.banner("🌈");
        this.tweens.add({ targets: this.glow, alpha: { from: 0, to: 0.22 }, duration: 350, yoyo: true, hold: 250 });
      }
      this.sound2.tada();
    } else {
      if (this.reduceMotion) this.fx.popAt(spr.x, spr.y);
      else { this.fx.bigParty(); this.fx.popAt(spr.x, spr.y); }
      this.sound2.fanfare();
    }
    // Linger, then fade the animal out and drop a fresh egg into the slot.
    this.time.delayedCall(REVEAL_HOLD_MS, () => {
      this.tweens.add({
        targets: spr, alpha: 0, scale: spr.scale * 0.8, duration: 250,
        onComplete: () => { this.reveals.killAndHide(spr); spr.setScale(1).setAlpha(1); },
      });
      this.fillEgg(e);
    });
  }

  // ---- drawing helpers ----
  private drawEgg(g: Phaser.GameObjects.Graphics, fill: number, line: number, golden: boolean) {
    g.clear();
    const steps = 48;
    g.fillStyle(fill, 1);
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      const cxp = Math.sin(th), cyp = -Math.cos(th);   // -1 (top) .. +1 (bottom)
      const w = EGG_RX * (1 + 0.16 * cyp);             // narrower at the top
      const x = cxp * w, y = cyp * EGG_RY;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fillPath();
    g.lineStyle(3, line, 1); g.strokePath();
    g.fillStyle(0xffffff, golden ? 0.4 : 0.28);
    g.fillEllipse(-EGG_RX * 0.32, -EGG_RY * 0.34, EGG_RX * 0.5, EGG_RY * 0.42); // glossy highlight
    if (!golden) {
      g.fillStyle(line, 0.5);
      for (const [sx, sy] of [[-12, 6], [10, 22], [-6, 30], [16, -8], [-18, 18]]) g.fillCircle(sx, sy, 2.5);
    }
  }

  private drawCracks(g: Phaser.GameObjects.Graphics, stage: Stage) {
    g.clear();
    if (stage === "intact") return;
    g.lineStyle(3, 0x5a4632, 1);
    const seam = (pts: number[][]) => {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.strokePath();
    };
    seam([[-2, -EGG_RY * 0.7], [6, -EGG_RY * 0.3], [-4, 0], [7, EGG_RY * 0.25]]);   // crack1: main seam
    if (stage === "crack1") return;
    seam([[6, -EGG_RY * 0.3], [22, -EGG_RY * 0.18], [30, 2]]);                       // crack2: + branch
    if (stage === "crack2") return;
    seam([[-4, 0], [-20, 8], [-28, -6]]);                                            // burst: full web
    seam([[7, EGG_RY * 0.25], [18, EGG_RY * 0.45], [4, EGG_RY * 0.6]]);
  }

  update(_t: number, dms: number) {
    this.bg.update(dms / 1000, this.scale.width);
  }
}
```

- [ ] **Step 2: Register the scene in `main.ts`**

In `src/main.ts`, add the import after the `SoundboardScene` import (line 8):

```ts
import { EggsScene } from "./scenes/EggsScene";
```

And add `EggsScene` to the end of the `scene:` array (line 23):

```ts
  scene: [BootScene, TitleScene, GameScene, CatchScene, PopScene, GumballScene, SoundboardScene, EggsScene],
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (no unused imports/params).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build completes; no TypeScript/Vite errors.

- [ ] **Step 5: Run the full test suite (no regressions)**

Run: `npm test`
Expected: PASS — the existing suite plus the Task 1 `eggs` tests.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/EggsScene.ts src/main.ts
git commit -m "feat(eggs): EggsScene (wobble/crack/hatch/reveal/refill) + register scene"
```

---

### Task 5: Title entry — 🥚 Surprise Eggs button

**Files:**
- Modify: `src/scenes/TitleScene.ts:51-57` (add the 6th button)

**Interfaces:**
- Consumes: the registered `"Eggs"` scene (Task 4); the existing `makeButton(x, y, emoji, label, color, onTap)` + `go(key)` helpers.
- Produces: a tappable title button that enters Surprise Eggs.

- [ ] **Step 1: Add the button**

In `src/scenes/TitleScene.ts`, after the Animal Soundboard button line, add:

```ts
    this.makeButton(W / 2, 1220, "🥚", "Surprise Eggs", 0xb39ddb, () => this.go("Eggs"));
```

This slots a 6th button into the existing single-column stack (y 630/748/866/984/1102/**1220**); at h=110 the last button bottoms at y=1275, within the 1280 logical height.

> **If the title has already been converted to a grid** (e.g. Peekaboo merged first and introduced a `makeGridButton` 2×3 layout), do **not** add a 6th single-column button — instead add 🥚 Surprise Eggs (`0xb39ddb` → `go("Eggs")`) as the next cell and resize the grid to fit (7 modes → a 2-col × 4-row grid). The button identity (emoji/label/colour/scene key) is the same either way.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build completes cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/TitleScene.ts
git commit -m "feat(eggs): add Surprise Eggs button to the title"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm test` — existing suite + new `eggs` tests pass.
- [ ] `npm run build` — clean; service worker emitted.
- [ ] `npm run eggs-audio` — regenerates crack1/2/3 + shatter (+ eggsmusic when online).
- [ ] **Preview pass (browser):** open the title, tap **🥚 Surprise Eggs**. Confirm:
  - 4 pastel eggs drop into the nest and wobble in place on a barnyard scene.
  - Each tap cracks the egg further (distinct stage + rising "tok"); the **3rd tap** flashes a full web, shatters into shards, and reveals a random animal (`Back.easeOut` pop) with a fanfare + party.
  - The animal lingers ~2.5s, fades, and a **fresh egg drops back** into that nest spot — endless.
  - A **golden egg** occasionally drops (gold shell + gentle breathe + sparkle) and hatches the **unicorn** with the 🌈 banner + tada + glow.
  - **Multi-touch** works (two fingers crack two eggs); off-centre taps still register; tapping a revealed animal does nothing.
  - **Reduced motion** (`prefers-reduced-motion`): eggs sit still, the shatter is a quick fade, no camera shake — still fully playable.
  - Back ⬅ returns to the title; **zero console errors**.

> Per the project's history, subagents may not have a browser — if so, the preview pass is a follow-up for the human after the tsc/test/build gates pass.

---

## Self-Review (plan author)

**Spec coverage:** §1 pure core → Task 1. §2 scene (wobble/crack/hatch/reveal/refill, multi-touch, golden, reduced-motion, music, back) → Task 4. §3 barnyard background → Task 3. §4 audio (SFX synth + music + Sound + Boot) → Task 2. §5 title button (adaptive) → Task 5. §6 file-changes + §7 verification → covered across tasks + Final verification. ✅

**Deviations from the spec (intentional, simpler — within "open items resolved during implementation"):**
- **Eggs are 4 fixed per-slot views, not a `Group` pool** — a pool buys nothing for a fixed clutch of 4; reveal sprites *are* pooled (`this.reveals`).
- **Golden cue is gold-fill + gentle breathe + periodic sparkle**, a dependency-free stand-in for `postFX.addShine` (avoids assuming post-FX support on a Container; same "special by motion" effect, photosensitivity-safe). Upgradeable later.
- **Shatter burst reuses the sparkle frame** (like Pop/Gumball) with `gravityY` for a falling-shard feel, rather than a bespoke shard texture — fewer moving parts; tint/shard-texture is a noted future refinement.
- **Title adds a 6th single-column button** (fits 1280) for the master base, with an explicit grid-fallback note for whatever merge order lands.

**Placeholder scan:** none — every code step contains complete content.

**Type consistency:** `Stage`/`nextStage`/`isHatched`/`TAPS_TO_HATCH`/`CLUTCH_SIZE` are defined in Task 1 and consumed with matching names/signatures in Task 4; `Sound.crack(stage:number)`/`shatter()` defined in Task 2 and called in Task 4; `EggsBackground(scene,W,H)` + `update(dt,W)` defined in Task 3 and used in Task 4; `createBag`/`JACKPOT`/`pickNearestWithinRadius`/`resetEmoji`/`EMOJI` match the real existing signatures read from the codebase. ✅
