# Rainbow Catch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, standalone "Rainbow Catch" mode — a no-fail falling-item catch mini-game with a self-balancing speed — reachable from a new title-screen button.

**Architecture:** A pure, unit-tested difficulty module (`src/core/catch.ts`) holds the self-balancing speed ladder; a standalone `CatchScene` renders it (free-roam pointer/arrow movement, pooled falling items, overlap catching, HUD, celebrations). A new animated unicorn is built from a supplied GIF into a sprite sheet via a `sharp` build script; a re-styled animated meadow background and a separate music playlist give the mode its own identity. The existing shooter and Rainbow modes are untouched.

**Tech Stack:** Phaser 4 (4.x), TypeScript (strict), Vite, Vitest (pure-logic only), `sharp` (build-time GIF decode), Node `https` (build-time track download).

**Spec:** [docs/superpowers/specs/2026-06-26-rainbow-catch-design.md](../specs/2026-06-26-rainbow-catch-design.md)
**Brief:** [docs/superpowers/research/2026-06-26-rainbow-catch-brief.md](../research/2026-06-26-rainbow-catch-brief.md)

## Global Constraints

- Phaser 4.x + TypeScript strict + Vite. `npm run build` runs `tsc --noEmit && vite build` and must stay green.
- Vitest unit tests cover **pure-logic `src/core/` modules only** (they import no Phaser). Scene / render / build-script / asset code is **not** unit-tested in this project — verify it with `npm run build` plus a manual run. This matches the existing codebase.
- No new runtime dependencies. Use what's installed: `sharp` and `@breezystack/lamejs` (devDeps) and Node built-ins (`https`, `fs`, `path`).
- No physics engine. All movement is manual delta-time: `position += speed * dt`, with `dt = dms / 1000`.
- Pure-logic modules must not import Phaser.
- Do **not** change `src/scenes/GameScene.ts` or `src/scenes/RainbowScene.ts` behavior.
- Scene key is exactly `"Catch"`. The title button label is exactly `"🌈  Rainbow Catch"` (two spaces after the emoji, matching the existing buttons).
- Catchable items exclude `balloon` and `cloud`. The background has no balloon.
- Catch music = 3 calm CC-BY Kevin MacLeod tracks (`catch1.mp3`–`catch3.mp3`), credited in `public/audio/CREDITS.md`. SFX are reused unchanged.
- The animated unicorn is used **only** in Catch mode, under the distinct texture key `"catchUnicorn"`. The shooter's unicorn (atlas frame `"unicorn"`) is untouched.
- Commit after every task.

## Asset precondition

Before **Task 2**, the file `assets/source/catch-unicorn.gif` (the animated unicorn supplied during the design session) must exist. The controller places it there (it is preserved in the session transcript). A fresh engineer without the session should obtain the GIF from the project owner. Task 2's build script generates `public/catch-unicorn/sheet.png` and `src/render/catchUnicorn.ts` from it.

## File structure

**Create:**
- `src/core/catch.ts` — pure self-balancing speed/difficulty model. (Task 1)
- `src/core/catch.test.ts` — Vitest tests for the model. (Task 1)
- `scripts/build-catch-unicorn.mjs` — GIF → horizontal sprite sheet + generated TS constants. (Task 2)
- `public/catch-unicorn/sheet.png` — generated sprite sheet (committed). (Task 2)
- `src/render/catchUnicorn.ts` — generated constants (key, sheet path, anim name, frame dims, frameRate). (Task 2)
- `scripts/build-catch-audio.mjs` — downloads the 3 catch tracks. (Task 3)
- `public/audio/catch1.mp3`, `catch2.mp3`, `catch3.mp3` — generated (committed). (Task 3)
- `src/scenes/ui/CatchBackground.ts` — animated meadow background. (Task 4)
- `src/scenes/CatchScene.ts` — the mode's scene. (Task 5)

**Modify:**
- `src/audio/sound.ts` — playlist support + `CATCH_MUSIC_KEYS`. (Task 3)
- `public/audio/CREDITS.md` — add the 3 catch tracks. (Task 3)
- `package.json` — `catch-unicorn` (Task 2) and `catch-audio` (Task 3) npm scripts.
- `src/scenes/BootScene.ts` — load catch sheet + tracks, register the unicorn animation. (Task 6)
- `src/main.ts` — register `CatchScene`. (Task 6)
- `src/scenes/TitleScene.ts` — add the third button. (Task 6)

---

### Task 1: Pure self-balancing speed model

**Suggested model:** cheap (mechanical, fully specified).

**Files:**
- Create: `src/core/catch.ts`
- Test: `src/core/catch.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface CatchState { notch: number; catchCount: number; missCount: number }`
  - `initialCatchState(): CatchState`
  - `resetForEntry(): CatchState` (alias of `initialCatchState`)
  - `recordCatch(s: CatchState): CatchState`
  - `recordMiss(s: CatchState): CatchState`
  - `speedForNotch(notch: number): number`
  - consts `SPEED_TABLE` (readonly number[]), `START_NOTCH`, `CATCHES_PER_STEP_UP`, `MISSES_PER_STEP_DOWN`

- [ ] **Step 1: Write the failing test**

Create `src/core/catch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  initialCatchState, resetForEntry, recordCatch, recordMiss, speedForNotch,
  SPEED_TABLE, START_NOTCH, CATCHES_PER_STEP_UP, MISSES_PER_STEP_DOWN,
} from "./catch";

describe("catch difficulty model", () => {
  it("starts at START_NOTCH with zeroed counters", () => {
    expect(initialCatchState()).toEqual({ notch: START_NOTCH, catchCount: 0, missCount: 0 });
  });

  it("resetForEntry matches initial state", () => {
    expect(resetForEntry()).toEqual(initialCatchState());
  });

  it("does not change notch before the catch threshold", () => {
    let s = initialCatchState();
    for (let i = 0; i < CATCHES_PER_STEP_UP - 1; i++) s = recordCatch(s);
    expect(s.notch).toBe(START_NOTCH);
    expect(s.catchCount).toBe(CATCHES_PER_STEP_UP - 1);
  });

  it("steps up after CATCHES_PER_STEP_UP catches and resets counters", () => {
    let s = initialCatchState();
    for (let i = 0; i < CATCHES_PER_STEP_UP; i++) s = recordCatch(s);
    expect(s).toEqual({ notch: START_NOTCH + 1, catchCount: 0, missCount: 0 });
  });

  it("does not change notch before the miss threshold", () => {
    let s = initialCatchState();
    for (let i = 0; i < MISSES_PER_STEP_DOWN - 1; i++) s = recordMiss(s);
    expect(s.notch).toBe(START_NOTCH);
    expect(s.missCount).toBe(MISSES_PER_STEP_DOWN - 1);
  });

  it("steps down after MISSES_PER_STEP_DOWN misses and resets counters", () => {
    let s = initialCatchState();
    for (let i = 0; i < MISSES_PER_STEP_DOWN; i++) s = recordMiss(s);
    expect(s).toEqual({ notch: START_NOTCH - 1, catchCount: 0, missCount: 0 });
  });

  it("a down-step also clears accumulated catches (anti-thrash)", () => {
    let s = initialCatchState();
    for (let i = 0; i < CATCHES_PER_STEP_UP - 1; i++) s = recordCatch(s); // 4 catches, no step
    expect(s.catchCount).toBe(CATCHES_PER_STEP_UP - 1);
    for (let i = 0; i < MISSES_PER_STEP_DOWN; i++) s = recordMiss(s);     // 3 misses -> step down
    expect(s).toEqual({ notch: START_NOTCH - 1, catchCount: 0, missCount: 0 });
  });

  it("never rises above the top of the speed table", () => {
    let s = initialCatchState();
    for (let i = 0; i < CATCHES_PER_STEP_UP * (SPEED_TABLE.length + 4); i++) s = recordCatch(s);
    expect(s.notch).toBe(SPEED_TABLE.length - 1);
    expect(speedForNotch(s.notch)).toBe(SPEED_TABLE[SPEED_TABLE.length - 1]);
  });

  it("never drops below the bottom of the speed table", () => {
    let s = initialCatchState();
    for (let i = 0; i < MISSES_PER_STEP_DOWN * (SPEED_TABLE.length + 4); i++) s = recordMiss(s);
    expect(s.notch).toBe(0);
    expect(speedForNotch(s.notch)).toBe(SPEED_TABLE[0]);
  });

  it("speedForNotch clamps out-of-range indices", () => {
    expect(speedForNotch(-5)).toBe(SPEED_TABLE[0]);
    expect(speedForNotch(999)).toBe(SPEED_TABLE[SPEED_TABLE.length - 1]);
    expect(speedForNotch(START_NOTCH)).toBe(SPEED_TABLE[START_NOTCH]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/core/catch.test.ts`
Expected: FAIL — cannot resolve module `./catch` (file does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/core/catch.ts`:

```ts
// Pure, framework-free self-balancing speed model for Rainbow Catch.
// One global fall speed sits on a notch ladder: catching speeds it up, missing
// slows it down. Stepped (not per-event), clamped, and reset on entry — so it
// always drifts toward the child's current skill and can never run away.
// No Phaser imports: this module is unit-tested headlessly.

export const SPEED_TABLE: readonly number[] = [90, 120, 150, 185, 220, 260, 300, 340]; // px/s
export const START_NOTCH = 1;            // ~120 px/s on entry
export const CATCHES_PER_STEP_UP = 5;    // +1 notch every 5 catches
export const MISSES_PER_STEP_DOWN = 3;   // -1 notch every 3 misses

export interface CatchState {
  notch: number;
  catchCount: number;
  missCount: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

export function initialCatchState(): CatchState {
  return { notch: START_NOTCH, catchCount: 0, missCount: 0 };
}

// Called when the player (re)enters the mode.
export function resetForEntry(): CatchState {
  return initialCatchState();
}

export function recordCatch(s: CatchState): CatchState {
  const catchCount = s.catchCount + 1;
  if (catchCount >= CATCHES_PER_STEP_UP) {
    return { notch: clamp(s.notch + 1, 0, SPEED_TABLE.length - 1), catchCount: 0, missCount: 0 };
  }
  return { notch: s.notch, catchCount, missCount: s.missCount };
}

export function recordMiss(s: CatchState): CatchState {
  const missCount = s.missCount + 1;
  if (missCount >= MISSES_PER_STEP_DOWN) {
    return { notch: clamp(s.notch - 1, 0, SPEED_TABLE.length - 1), catchCount: 0, missCount: 0 };
  }
  return { notch: s.notch, catchCount: s.catchCount, missCount };
}

export function speedForNotch(notch: number): number {
  return SPEED_TABLE[clamp(notch, 0, SPEED_TABLE.length - 1)];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/core/catch.test.ts`
Expected: PASS — all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/core/catch.ts src/core/catch.test.ts
git commit -m "feat(catch): pure self-balancing speed model + tests"
```

---

### Task 2: Animated unicorn sprite sheet (build pipeline)

**Suggested model:** standard (asset pipeline, libvips nuance).

**Files:**
- Create: `scripts/build-catch-unicorn.mjs`
- Create (generated, committed): `public/catch-unicorn/sheet.png`, `src/render/catchUnicorn.ts`
- Modify: `package.json` (add `catch-unicorn` script)
- Precondition: `assets/source/catch-unicorn.gif` exists (see "Asset precondition").

**Interfaces:**
- Consumes: nothing (reads the GIF).
- Produces (in generated `src/render/catchUnicorn.ts`):
  - `CATCH_UNICORN_KEY: string` = `"catchUnicorn"`
  - `CATCH_UNICORN_SHEET: string` = `"catch-unicorn/sheet.png"`
  - `CATCH_UNICORN_ANIM: string` = `"catch-fly"`
  - `CATCH_UNICORN: { frameWidth: number; frameHeight: number; frameCount: number; frameRate: number }`

- [ ] **Step 1: Ensure the source GIF is present**

Run: `node -e "require('fs').accessSync('assets/source/catch-unicorn.gif')"`
Expected: no error (exit 0). If it errors, stop and obtain the GIF (see "Asset precondition").

- [ ] **Step 2: Write the build script**

Create `scripts/build-catch-unicorn.mjs`:

```js
/**
 * build-catch-unicorn.mjs
 * Decodes the animated unicorn GIF into a horizontal sprite sheet for Phaser,
 * and writes a TS constants module so the loader needs no magic numbers.
 *
 * Input:  assets/source/catch-unicorn.gif
 * Output: public/catch-unicorn/sheet.png
 *         src/render/catchUnicorn.ts
 * Run: node scripts/build-catch-unicorn.mjs
 */
import sharp from "sharp";
import { mkdirSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "assets", "source", "catch-unicorn.gif");
const OUT_PNG_DIR = join(ROOT, "public", "catch-unicorn");
const OUT_PNG = join(OUT_PNG_DIR, "sheet.png");
const OUT_TS = join(ROOT, "src", "render", "catchUnicorn.ts");

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

async function main() {
  if (!existsSync(SRC)) {
    console.error(`Missing source GIF: ${SRC}`);
    console.error("Place the animated unicorn GIF there, then re-run.");
    process.exit(1);
  }

  const meta = await sharp(SRC, { animated: true }).metadata();
  const fw = meta.width;
  const fh = meta.pageHeight ?? meta.height;
  const n = meta.pages ?? 1;
  console.log(`GIF: ${fw}x${fh}, ${n} frame(s)`);

  // libvips renders each GIF page fully composited (disposal handled); an
  // animated read stacks the pages vertically. Pull raw RGBA and slice pages.
  const { data } = await sharp(SRC, { animated: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const composites = [];
  for (let i = 0; i < n; i++) {
    const frame = await sharp(data, { raw: { width: fw, height: fh * n, channels: 4 } })
      .extract({ left: 0, top: i * fh, width: fw, height: fh })
      .png()
      .toBuffer();
    composites.push({ input: frame, left: i * fw, top: 0 });
  }

  if (!existsSync(OUT_PNG_DIR)) mkdirSync(OUT_PNG_DIR, { recursive: true });
  const sheet = await sharp({
    create: { width: fw * n, height: fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites).png().toBuffer();
  await writeFile(OUT_PNG, sheet);
  console.log(`Wrote ${OUT_PNG} (${sheet.length} bytes, ${fw * n}x${fh})`);

  // frameRate from the average GIF frame delay (fallback 12 fps), clamped sane.
  const delays = Array.isArray(meta.delay) && meta.delay.length ? meta.delay : null;
  const avgDelayMs = delays ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
  const frameRate = avgDelayMs > 0 ? clamp(Math.round(1000 / avgDelayMs), 6, 24) : 12;

  const ts = `// AUTO-GENERATED by scripts/build-catch-unicorn.mjs — do not edit by hand.
export const CATCH_UNICORN_KEY = "catchUnicorn";
export const CATCH_UNICORN_SHEET = "catch-unicorn/sheet.png";
export const CATCH_UNICORN_ANIM = "catch-fly";
export const CATCH_UNICORN = {
  frameWidth: ${fw},
  frameHeight: ${fh},
  frameCount: ${n},
  frameRate: ${frameRate},
} as const;
`;
  await writeFile(OUT_TS, ts);
  console.log(`Wrote ${OUT_TS} (frameRate ${frameRate})`);
}

main().catch((e) => { console.error("Catch unicorn build failed:", e); process.exit(1); });
```

- [ ] **Step 3: Add the npm script**

In `package.json`, inside `"scripts"`, add the `catch-unicorn` line (after `"icons"`):

```json
    "icons": "node scripts/build-icons.mjs",
    "catch-unicorn": "node scripts/build-catch-unicorn.mjs"
```

- [ ] **Step 4: Run the build and verify outputs**

Run: `npm run catch-unicorn`
Expected: logs `GIF: <W>x<H>, <N> frame(s)`, then `Wrote .../public/catch-unicorn/sheet.png` and `Wrote .../src/render/catchUnicorn.ts (frameRate <R>)`. Confirm both files exist:
Run: `node -e "require('fs').accessSync('public/catch-unicorn/sheet.png'); require('fs').accessSync('src/render/catchUnicorn.ts'); console.log('ok')"`
Expected: `ok`.
Open `public/catch-unicorn/sheet.png` and eyeball it: N frames laid left-to-right, each the full unicorn, transparent background, no torn/ghosted pixels. If frames look partial/ghosted, the GIF uses an unusual disposal mode — note it for follow-up (the spec flags this as an open item) but proceed.

- [ ] **Step 5: Verify the generated module type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-catch-unicorn.mjs package.json public/catch-unicorn/sheet.png src/render/catchUnicorn.ts
git commit -m "feat(catch): build animated unicorn sprite sheet from GIF"
```

---

### Task 3: Catch music tracks + Sound playlist support

**Suggested model:** standard.

**Files:**
- Create: `scripts/build-catch-audio.mjs`
- Create (generated, committed): `public/audio/catch1.mp3`, `catch2.mp3`, `catch3.mp3`
- Modify: `src/audio/sound.ts`, `public/audio/CREDITS.md`, `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/audio/sound.ts` exports unchanged `Sound` class plus new `CATCH_MUSIC_KEYS: readonly string[]` = `["catch1","catch2","catch3"]`.
  - `Sound.playMusic(playlist?: readonly string[]): void` — defaults to the existing music; pass `CATCH_MUSIC_KEYS` for the catch playlist.

- [ ] **Step 1: Write the download script**

Create `scripts/build-catch-audio.mjs`:

```js
/**
 * build-catch-audio.mjs
 * Downloads 3 calm royalty-free Kevin MacLeod tracks (CC-BY) for the Rainbow
 * Catch playlist. Output: public/audio/catch1.mp3 .. catch3.mp3
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-catch-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACKS = [
  { file: "catch1.mp3", title: "Sneaky Adventure",  url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Adventure.mp3" },
  { file: "catch2.mp3", title: "Cheery Monday",      url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cheery%20Monday.mp3" },
  { file: "catch3.mp3", title: "Pleasant Porridge",  url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pleasant%20Porridge.mp3" },
];

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume();
        download(res.headers.location, dest, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const out = createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", (e) => { try { unlinkSync(dest); } catch {} reject(e); });
    }).on("error", reject);
  });
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  let failed = 0;
  for (const t of TRACKS) {
    const dest = join(OUT_DIR, t.file);
    process.stdout.write(`Downloading ${t.title} -> ${t.file} ... `);
    try { await download(t.url, dest); console.log("ok"); }
    catch (e) { failed++; console.error(`FAILED: ${e.message} — pick another calm CC-BY track and update the URL + CREDITS.md`); }
  }
  if (failed) process.exitCode = 1;
}
main();
```

- [ ] **Step 2: Add the npm script**

In `package.json` `"scripts"`, add after the `catch-unicorn` line:

```json
    "catch-unicorn": "node scripts/build-catch-unicorn.mjs",
    "catch-audio": "node scripts/build-catch-audio.mjs"
```

- [ ] **Step 3: Run the download and verify the 3 tracks**

Run: `npm run catch-audio`
Expected: three `... ok` lines. Verify:
Run: `node -e "['catch1','catch2','catch3'].forEach(k=>require('fs').accessSync('public/audio/'+k+'.mp3'));console.log('ok')"`
Expected: `ok`.
If any track 404s, choose another calm Kevin MacLeod CC-BY track from incompetech.com (e.g. "Wallpaper", "The Builder", "Bumbly March"), update its `url` and `title` in the script, update `CREDITS.md` in Step 5 accordingly, and re-run.

- [ ] **Step 4: Add playlist support to Sound**

Replace the full contents of `src/audio/sound.ts` with:

```ts
import Phaser from "phaser";
import { settings } from "../state/settings";

const MUSIC_KEYS = ["music1", "music2", "music3", "music4"] as const;
export const CATCH_MUSIC_KEYS: readonly string[] = ["catch1", "catch2", "catch3"];

export class Sound {
  private _lastMusicKey: string | null = null;
  private _current?: Phaser.Sound.BaseSound;
  private _playlist: readonly string[] = MUSIC_KEYS;

  constructor(private scene: Phaser.Scene) {}

  private _pickNextTrack(): string {
    const candidates = this._playlist.filter((k) => k !== this._lastMusicKey);
    const pool = candidates.length ? candidates : this._playlist;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private _playTrack(key: string): void {
    const vol = settings.calm ? 0.25 : 0.5;
    this._lastMusicKey = key;
    const prev = this._current;
    const m = this.scene.sound.add(key, { loop: false, volume: vol });
    this._current = m;
    m.once("complete", () => {
      this._playTrack(this._pickNextTrack());
    });
    m.play();
    // Free the just-finished previous track so finished tracks don't accumulate.
    if (prev) prev.destroy();
  }

  playMusic(playlist: readonly string[] = MUSIC_KEYS): void {
    this._playlist = playlist;
    this._lastMusicKey = null;
    this._playTrack(this._pickNextTrack());
  }

  collect(): void {
    this.scene.sound.play("collect", { volume: settings.calm ? 0.35 : 0.7 });
  }
  pop(): void {
    this.scene.sound.play("pop", { volume: settings.calm ? 0.3 : 0.6 });
  }
  fanfare(): void {
    this.scene.sound.play("fanfare", { volume: settings.calm ? 0.35 : 0.7 });
  }
  tada(): void {
    this.scene.sound.play("tada", { volume: settings.calm ? 0.4 : 0.8 });
  }
}
```

(This keeps `playMusic()` with no argument behaving exactly as before for the shooter and Rainbow modes.)

- [ ] **Step 5: Update the audio credits**

In `public/audio/CREDITS.md`, add these rows to the music table (under the existing `music4.mp3` row), adjusting titles/URLs if you substituted any track in Step 3:

```markdown
| catch1.mp3 | Sneaky Adventure  | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Adventure.mp3  | CC-BY 4.0 |
| catch2.mp3 | Cheery Monday     | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cheery%20Monday.mp3     | CC-BY 4.0 |
| catch3.mp3 | Pleasant Porridge | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pleasant%20Porridge.mp3 | CC-BY 4.0 |
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-catch-audio.mjs package.json src/audio/sound.ts public/audio/CREDITS.md public/audio/catch1.mp3 public/audio/catch2.mp3 public/audio/catch3.mp3
git commit -m "feat(catch): catch music playlist (3 CC-BY tracks) + Sound playlist support"
```

---

### Task 4: Animated meadow background

**Suggested model:** standard.

**Files:**
- Create: `src/scenes/ui/CatchBackground.ts`

**Interfaces:**
- Consumes: `settings` from `src/state/settings.ts` (`settings.calm`).
- Produces: `class CatchBackground extends Phaser.GameObjects.Container` with `constructor(scene, width, height)`, `resize(width, height): void`, `update(dt: number): void`.

- [ ] **Step 1: Write the background**

Create `src/scenes/ui/CatchBackground.ts`:

```ts
import Phaser from "phaser";
import { settings } from "../../state/settings";

// Shape-based animated "parallax meadow" for Rainbow Catch. Distinct in style
// from the shooter's gradient sky. Motion sits low/peripheral so it doesn't
// compete with the falling items. Calm mode freezes the motion.
export class CatchBackground extends Phaser.GameObjects.Container {
  private sky: Phaser.GameObjects.Graphics;
  private hills: Phaser.GameObjects.Graphics;
  private sun: Phaser.GameObjects.Container;
  private clouds: Phaser.GameObjects.Ellipse[] = [];
  private ground: Phaser.GameObjects.Container;
  private w = 0;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(-10);

    this.sky = scene.add.graphics();
    this.add(this.sky);

    // Sun: a disc plus radiating spokes; the whole container rotates.
    this.sun = scene.add.container(0, 0);
    this.add(this.sun);
    const rays = scene.add.graphics();
    rays.lineStyle(6, 0xffd23f, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      rays.beginPath();
      rays.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
      rays.lineTo(Math.cos(a) * 50, Math.sin(a) * 50);
      rays.strokePath();
    }
    const disc = scene.add.circle(0, 0, 28, 0xffd23f);
    this.sun.add(rays);
    this.sun.add(disc);

    for (let i = 0; i < 3; i++) {
      const c = scene.add.ellipse(0, 0, 150, 70, 0xffffff, 0.92);
      this.clouds.push(c);
      this.add(c);
    }

    this.hills = scene.add.graphics();
    this.add(this.hills);

    this.ground = scene.add.container(0, 0);
    this.add(this.ground);

    this.resize(width, height);
  }

  private buildGround(width: number, height: number): void {
    this.ground.removeAll(true);
    const baseY = height - 40;
    const colors = [0xff6fa5, 0xffd23f, 0x9b6bff, 0x5bc0ff, 0xff8fcf];
    const step = 90;
    // Two side-by-side copies so the strip can scroll seamlessly by `width`.
    for (let copy = 0; copy < 2; copy++) {
      let k = 0;
      for (let x = 30; x < width; x += step, k++) {
        const fx = x + copy * width;
        this.ground.add(this.scene.add.rectangle(fx, baseY, 4, 22, 0x2f7d2a));
        this.ground.add(this.scene.add.circle(fx, baseY - 16, 9, colors[k % colors.length]));
      }
    }
  }

  resize(width: number, height: number): void {
    this.w = width;

    this.sky.clear();
    this.sky.fillStyle(0xa9e2ff, 1).fillRect(0, 0, width, height);

    const horizon = height - 90;
    this.hills.clear();
    this.hills.fillStyle(0x8fd267, 1);
    this.hills.fillCircle(width * 0.25, horizon + 40, 140);
    this.hills.fillCircle(width * 0.7, horizon + 30, 170);
    this.hills.fillStyle(0x5fb94a, 1);
    this.hills.fillRect(0, horizon, width, height - horizon);

    this.sun.setPosition(90, 110);
    this.clouds.forEach((c, i) => c.setPosition((width / 4) * (i + 1), 150 + (i % 2) * 70));

    this.buildGround(width, height);
  }

  update(dt: number): void {
    if (settings.calm) return; // calm mode: motion frozen
    this.sun.rotation += dt * 0.25;
    for (const c of this.clouds) {
      c.x += 14 * dt;
      if (c.x > this.w + 90) c.x = -90;
    }
    this.ground.x -= 70 * dt;
    if (this.ground.x <= -this.w) this.ground.x += this.w;
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ui/CatchBackground.ts
git commit -m "feat(catch): animated meadow background (calm-aware)"
```

---

### Task 5: Catch scene

**Suggested model:** most capable (multi-piece integration in one file).

**Files:**
- Create: `src/scenes/CatchScene.ts`

**Interfaces:**
- Consumes:
  - `CatchBackground` (Task 4): `new CatchBackground(scene, w, h)`, `.update(dt)`.
  - `src/render/catchUnicorn.ts` (Task 2): `CATCH_UNICORN_KEY`, `CATCH_UNICORN_ANIM`, `CATCH_UNICORN.frameHeight`.
  - `src/audio/sound.ts` (Task 3): `Sound`, `CATCH_MUSIC_KEYS`.
  - `src/core/catch.ts` (Task 1): `initialCatchState`, `recordCatch`, `recordMiss`, `speedForNotch`, `CatchState`.
  - `src/render/sprites.ts` (existing): `ATLAS_KEY`, `frameFor`.
  - `src/core/input.ts` (existing): `resolveTarget(cur: {x,y}, input: AimInput, keySpeed: number, dt: number, bounds: Bounds): {x,y}`, types `AimInput`, `Bounds`.
  - `src/core/collision.ts` (existing): `circleOverlap(a: Circle, b: Circle): boolean`.
  - `src/scenes/ui/Celebrations.ts` (existing): `Celebrations` with `popAt(x,y)`, `banner(text)`, `bigParty()`.
- Produces: `class CatchScene extends Phaser.Scene` with scene key `"Catch"`.

- [ ] **Step 1: Write the scene**

Create `src/scenes/CatchScene.ts`:

```ts
import Phaser from "phaser";
import { CatchBackground } from "./ui/CatchBackground";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM, CATCH_UNICORN } from "../render/catchUnicorn";
import { resolveTarget, type AimInput, type Bounds } from "../core/input";
import { circleOverlap } from "../core/collision";
import { Sound, CATCH_MUSIC_KEYS } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { initialCatchState, recordCatch, recordMiss, speedForNotch, type CatchState } from "../core/catch";

const KEY_SPEED = 1600;        // px/s for arrow-key movement
const SPAWN_INTERVAL = 1.1;    // seconds, fixed (independent of fall speed)
const MAX_CONCURRENT = 4;      // cap on-screen items (UX: keep it uncluttered)
const CATCH_RADIUS = 95;       // generous; larger than the visible unicorn
const CELEBRATION_EVERY = 25;  // catches per milestone celebration
const UNICORN_DISPLAY_H = 150; // target on-screen unicorn height in px

// Cosmetic variety only (no balloon, no cloud). All caught the same way.
const CATCH_ITEM_TYPES = ["gem", "heart", "cupcake", "star", "lollipop", "icecream", "donut", "flower", "butterfly"];

export class CatchScene extends Phaser.Scene {
  private bg!: CatchBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private unicorn!: Phaser.GameObjects.Sprite;
  private target = { x: 0, y: 0 };
  private pointerActive = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private items!: Phaser.GameObjects.Group;
  private spawnTimer = 0;

  private state: CatchState = initialCatchState();
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super("Catch");
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.bg = new CatchBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.sound2.playMusic(CATCH_MUSIC_KEYS);
    this.fx = new Celebrations(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sound.stopAll());

    this.state = initialCatchState();
    this.score = 0;

    this.target = { x: W / 2, y: H * 0.55 };
    this.unicorn = this.add.sprite(this.target.x, this.target.y, CATCH_UNICORN_KEY).setDepth(10);
    this.unicorn.setScale(UNICORN_DISPLAY_H / CATCH_UNICORN.frameHeight);
    this.unicorn.play(CATCH_UNICORN_ANIM);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => { this.pointerActive = true; this.target = { x: p.worldX, y: p.worldY }; });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => { this.pointerActive = true; this.target = { x: p.worldX, y: p.worldY }; });

    this.items = this.add.group();
    this.spawnTimer = 0;

    this.scoreText = this.add.text(24, 24, "⭐ 0", {
      fontSize: "44px", color: "#ffffff", fontStyle: "bold", stroke: "#2f7d2a", strokeThickness: 6,
    }).setDepth(1000);

    // Simple "back to title" tap target (top-right). No game-over otherwise.
    const back = this.add.text(W - 24, 24, "⬅", { fontSize: "44px" }).setOrigin(1, 0).setDepth(1000)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("Title"));
  }

  private bounds(): Bounds {
    return { minX: 60, maxX: this.scale.width - 60, minY: 140, maxY: this.scale.height - 120 };
  }

  private aimInput(): AimInput {
    return {
      pointer: this.pointerActive ? this.target : null,
      keys: {
        left: this.cursors.left.isDown,
        right: this.cursors.right.isDown,
        up: this.cursors.up.isDown,
        down: this.cursors.down.isDown,
      },
    };
  }

  private spawnItem() {
    const type = CATCH_ITEM_TYPES[Math.floor(Math.random() * CATCH_ITEM_TYPES.length)];
    const x = 80 + Math.random() * (this.scale.width - 160);
    let c = this.items.getFirstDead(false) as Phaser.GameObjects.Image | null;
    if (!c) {
      c = this.add.image(x, -40, ATLAS_KEY, frameFor(type)).setScale(1.1);
      this.items.add(c);
    } else {
      c.setPosition(x, -40).setTexture(ATLAS_KEY, frameFor(type)).setActive(true).setVisible(true).setScale(1.1).setAngle(0);
    }
  }

  private celebrate() {
    this.fx.bigParty();
    this.fx.banner("🌈");
    this.sound2.fanfare();
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.bg.update(dt);

    // Movement: pointer-follow, or arrow keys take over while held.
    if (this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown || this.cursors.down.isDown) {
      this.pointerActive = false;
    }
    const cur = { x: this.unicorn.x, y: this.unicorn.y };
    const next = resolveTarget(cur, this.aimInput(), KEY_SPEED, dt, this.bounds());
    this.unicorn.x = Phaser.Math.Linear(this.unicorn.x, next.x, Math.min(1, 12 * dt));
    this.unicorn.y = Phaser.Math.Linear(this.unicorn.y, next.y, Math.min(1, 12 * dt));

    // Spawn at a fixed interval, capped.
    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL) {
      this.spawnTimer = 0;
      if (this.items.countActive(true) < MAX_CONCURRENT) this.spawnItem();
    }

    // Fall + catch/miss. One global speed applied to all in-flight items.
    const speed = speedForNotch(this.state.notch);
    const ux = this.unicorn.x, uy = this.unicorn.y;
    (this.items.getChildren() as Phaser.GameObjects.Image[]).forEach((c) => {
      if (!c.active) return;
      c.y += speed * dt;
      c.rotation += dt * 1.6;

      if (circleOverlap({ x: c.x, y: c.y, r: CATCH_RADIUS }, { x: ux, y: uy, r: 0 })) {
        this.items.killAndHide(c);
        this.state = recordCatch(this.state);
        this.score += 1;
        this.scoreText.setText(`⭐ ${this.score}`);
        this.fx.popAt(c.x, c.y);
        this.sound2.collect();
        if (this.score % CELEBRATION_EVERY === 0) this.celebrate();
        return;
      }

      if (c.y > this.scale.height + 50) {
        this.items.killAndHide(c);
        this.state = recordMiss(this.state);
      }
    });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (Confirmed against `src/core/input.ts`: `resolveTarget(current, input, keySpeed, dt, bounds): Vec2` with `AimInput.pointer: Vec2 | null` and `Bounds {minX,maxX,minY,maxY}` — the call mirrors `GameScene.update`.)

- [ ] **Step 3: Commit**

```bash
git add src/scenes/CatchScene.ts
git commit -m "feat(catch): Catch scene — free-roam catching, self-balancing speed, HUD, celebration"
```

---

### Task 6: Wire-up — Boot load, scene registration, title button

**Suggested model:** standard.

**Files:**
- Modify: `src/scenes/BootScene.ts`, `src/main.ts`, `src/scenes/TitleScene.ts`

**Interfaces:**
- Consumes: `CatchScene` (Task 5); `catchUnicorn.ts` constants (Task 2); `CATCH_MUSIC_KEYS` track files (Task 3).
- Produces: a playable mode reachable from the title.

- [ ] **Step 1: Load catch assets + register the unicorn animation in Boot**

Replace the full contents of `src/scenes/BootScene.ts` with:

```ts
import Phaser from "phaser";
import { ATLAS_KEY } from "../render/sprites";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_SHEET, CATCH_UNICORN_ANIM, CATCH_UNICORN } from "../render/catchUnicorn";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    this.load.atlas(ATLAS_KEY, "atlas/openmoji.png", "atlas/openmoji.json");
    this.load.audio("music1", ["audio/music1.mp3"]);
    this.load.audio("music2", ["audio/music2.mp3"]);
    this.load.audio("music3", ["audio/music3.mp3"]);
    this.load.audio("music4", ["audio/music4.mp3"]);
    this.load.audio("catch1", ["audio/catch1.mp3"]);
    this.load.audio("catch2", ["audio/catch2.mp3"]);
    this.load.audio("catch3", ["audio/catch3.mp3"]);
    this.load.audio("collect", ["audio/collect.mp3"]);
    this.load.audio("pop", ["audio/pop.mp3"]);
    this.load.audio("fanfare", ["audio/fanfare.mp3"]);
    this.load.audio("tada", ["audio/tada.mp3"]);
    this.load.spritesheet(CATCH_UNICORN_KEY, CATCH_UNICORN_SHEET, {
      frameWidth: CATCH_UNICORN.frameWidth,
      frameHeight: CATCH_UNICORN.frameHeight,
    });
    // Loading progress bar (no text — pre-readers).
    const g = this.add.graphics();
    this.load.on("progress", (p: number) => {
      g.clear().fillStyle(0xffffff, 0.9).fillRect(160, 630, 400 * p, 20);
    });
  }
  create() {
    // Register the looping catch-unicorn animation globally (once).
    if (!this.anims.exists(CATCH_UNICORN_ANIM)) {
      this.anims.create({
        key: CATCH_UNICORN_ANIM,
        frames: this.anims.generateFrameNumbers(CATCH_UNICORN_KEY, { start: 0, end: CATCH_UNICORN.frameCount - 1 }),
        frameRate: CATCH_UNICORN.frameRate,
        repeat: -1,
      });
    }
    this.scene.start("Title");
  }
}
```

- [ ] **Step 2: Register the scene in main**

In `src/main.ts`, add the import after the `RainbowScene` import:

```ts
import { RainbowScene } from "./scenes/RainbowScene";
import { CatchScene } from "./scenes/CatchScene";
```

and add `CatchScene` to the `scene` array:

```ts
  scene: [BootScene, TitleScene, GameScene, RainbowScene, CatchScene],
```

- [ ] **Step 3: Add the title button**

In `src/scenes/TitleScene.ts`, add a third button immediately after the existing "Rainbow Mode" line:

```ts
    this.makeButton(W / 2, 880, "🌈  Rainbow Mode", 0x7ec8ff, () => this.scene.start("Rainbow"));
    this.makeButton(W / 2, 1040, "🌈  Rainbow Catch", 0x7ed957, () => this.scene.start("Catch"));
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: `tsc --noEmit` passes and `vite build` completes with no errors.

- [ ] **Step 5: Manual run (verification)**

Run: `npm run dev`, open the served URL, and verify:
- The title shows three buttons; **"🌈 Rainbow Catch"** (green) starts the Catch scene.
- The meadow background animates (sun spins, clouds drift, flower strip scrolls); the unicorn animation loops.
- Moving the mouse/finger moves the unicorn freely (full area, not just the bottom); arrow keys also move it.
- Catching items increments the count top-left and plays the collect chime; items spin as they fall.
- After a good run the items visibly speed up; after several misses they slow down; missing never ends the game.
- The 25th catch triggers the celebration (party + 🌈 banner + happy sound).
- Toggling calm mode (✨/🌙 on the title) quiets the celebration and freezes background motion in the Catch scene.
- The ⬅ top-right returns to the title; re-entering resets the speed and count.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/BootScene.ts src/main.ts src/scenes/TitleScene.ts
git commit -m "feat(catch): wire Rainbow Catch into boot, scene list, and title"
```

---

## Self-review

**Spec coverage** (each spec §2 success criterion → task):
1. Third "🌈 Rainbow Catch" button → `Catch` scene — Task 6 (button), Task 5 (scene). ✓
2. Free-roam catching with generous overlap — Task 5 (`resolveTarget` free-roam bounds, `CATCH_RADIUS`). ✓
3. Self-balancing stepped, catch/miss-only, clamped, reset on entry — Task 1 (model) + Task 5 (wired). ✓
4. No-fail (miss only slows) — Task 5 (`recordMiss`, no game-over path). ✓
5. Catch count top-left + celebration every 25 — Task 5. ✓
6. Animated meadow + animated unicorn + catch playlist + reused SFX — Tasks 4, 2, 3 (+ Boot in 6). ✓
7. Pure difficulty module with tests; shooter/Rainbow untouched — Task 1; constraints honored. ✓

**Placeholder scan:** No `TBD`/`TODO`/"implement later". The music URLs are concrete with a defined substitution procedure if one 404s. Frame dimensions are computed by the build script (not hand-filled) and consumed via generated constants. ✓

**Type consistency:** `CatchState`, `initialCatchState`, `recordCatch`, `recordMiss`, `speedForNotch` are defined in Task 1 and consumed with the same names/shapes in Task 5. `CATCH_UNICORN_KEY`/`CATCH_UNICORN_SHEET`/`CATCH_UNICORN_ANIM`/`CATCH_UNICORN` are produced in Task 2 and consumed identically in Tasks 5 and 6. `CATCH_MUSIC_KEYS` and `Sound.playMusic(playlist?)` are produced in Task 3 and consumed in Task 5; the no-arg `playMusic()` default preserves existing callers. `CatchBackground(scene,w,h)` / `.update(dt)` produced in Task 4, consumed in Task 5. ✓

Verified against `src/core/input.ts`: the `resolveTarget`/`AimInput`/`Bounds` signatures match the Task 5 usage exactly (the call mirrors `GameScene.update`).
