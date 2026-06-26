# Pop the Cuties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third game mode, "Pop the Cuties" — cute animated emoji bubble-float upward and the child taps to pop them into a sparkle burst.

**Architecture:** A standalone `Phaser.Scene` (`PopScene`) reuses the existing pure self-balancing speed model (`src/core/catch.ts`) and a tiny new pure module (`src/core/pop.ts`) for nearest-target selection and the bonus-spawn decision. Rendering reuses the animated-emoji spritesheets (`spawnEmoji`/`resetEmoji`), the OpenMoji `sparkle` frame (for a pooled particle burst), and `Celebrations`. A new shape-based `UnderwaterBackground` and a dedicated music track give the mode its identity.

**Tech Stack:** Phaser 4 (WebGL), TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), Vite, Vitest, sharp/https build scripts. No new runtime dependencies.

## Global Constraints

- **No new runtime dependencies** — reuse Phaser 4 + existing helpers only.
- **Reuse, don't duplicate:** the float speed reuses `src/core/catch.ts` (pop = `recordCatch`, escape = `recordMiss`, speed = `speedForNotch`); cuties use `spawnEmoji`/`resetEmoji`; bursts use `Celebrations`/the atlas `sparkle` frame.
- **Pure logic is Vitest-tested**; scenes/backgrounds are not unit-tested (verified by running the game).
- **Existing modes (Rainbow Shoot, Rainbow Catch) must be untouched** behaviorally.
- **No-fail, kid-friendly:** an escape only slows the game; no game-over/lives/penalty.
- **Exact names/values:** scene key `"Pop"`; title button label `"🫧  Pop the Cuties"`, color `0xff5fa2`, at `y ≈ 1040` → `this.scene.start("Pop")`; milestone every **20** pops; on-screen cap **12**; pop radius ~**90 px**.
- **TypeScript must compile** (`npx tsc --noEmit`) and **`npm run build`** must pass for every task; `npm test` (currently 56 tests) must stay green.
- Cutie types use the existing emoji keys from `src/render/emoji.ts` (note: keys `icecream`/`donut`/`cupcake`/`lollipop` now render tulip/ladybug/clover/cat).

---

### Task 1: Pure logic — `src/core/pop.ts` (+ tests)

**Files:**
- Create: `src/core/pop.ts`
- Test: `src/core/pop.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no imports).
- Produces:
  - `interface TargetLike { x: number; y: number; }`
  - `pickNearestWithinRadius(px: number, py: number, targets: readonly TargetLike[], radius: number): number` — index of nearest target within `radius`, ties by lowest index, else `-1`.
  - `const BONUS_MIN_GAP = 12`, `const BONUS_CHANCE = 0.08`
  - `shouldSpawnBonus(spawnsSinceBonus: number, rng: () => number): boolean`

- [ ] **Step 1: Write the failing tests**

Create `src/core/pop.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickNearestWithinRadius, shouldSpawnBonus, BONUS_MIN_GAP, BONUS_CHANCE } from "./pop";

describe("pickNearestWithinRadius", () => {
  it("returns -1 for an empty list", () => {
    expect(pickNearestWithinRadius(0, 0, [], 100)).toBe(-1);
  });
  it("returns -1 when every target is outside the radius", () => {
    const targets = [{ x: 200, y: 0 }, { x: 0, y: 300 }];
    expect(pickNearestWithinRadius(0, 0, targets, 100)).toBe(-1);
  });
  it("returns the nearest index among several inside the radius", () => {
    const targets = [{ x: 90, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }];
    expect(pickNearestWithinRadius(0, 0, targets, 100)).toBe(1);
  });
  it("breaks ties by lowest index", () => {
    const targets = [{ x: 50, y: 0 }, { x: 0, y: 50 }];
    expect(pickNearestWithinRadius(0, 0, targets, 100)).toBe(0);
  });
  it("counts a target exactly on the radius as a hit", () => {
    const targets = [{ x: 100, y: 0 }];
    expect(pickNearestWithinRadius(0, 0, targets, 100)).toBe(0);
  });
});

describe("shouldSpawnBonus", () => {
  it("is false while below the minimum gap, even with a tiny rng", () => {
    expect(shouldSpawnBonus(BONUS_MIN_GAP - 1, () => 0)).toBe(false);
  });
  it("is true at/after the gap when rng is below the chance", () => {
    expect(shouldSpawnBonus(BONUS_MIN_GAP, () => BONUS_CHANCE - 0.001)).toBe(true);
  });
  it("is false at/after the gap when rng is at/above the chance", () => {
    expect(shouldSpawnBonus(BONUS_MIN_GAP + 5, () => BONUS_CHANCE)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/pop.test.ts`
Expected: FAIL — `Failed to resolve import "./pop"` / functions not defined.

- [ ] **Step 3: Write the implementation**

Create `src/core/pop.ts`:

```ts
// Pure, framework-free helpers for Pop the Cuties (tap-to-pop). No Phaser
// imports: unit-tested headlessly. The float speed/difficulty is shared with
// src/core/catch.ts (a pop = recordCatch, an escape = recordMiss).

export interface TargetLike { x: number; y: number; }

// Index of the nearest target within `radius` of (px,py), or -1 if none.
// Ties resolved by lowest index. Uses squared distance (no sqrt needed).
export function pickNearestWithinRadius(
  px: number, py: number, targets: readonly TargetLike[], radius: number,
): number {
  const r2 = radius * radius;
  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < targets.length; i++) {
    const dx = targets[i].x - px;
    const dy = targets[i].y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && d2 < bestD2) { bestD2 = d2; best = i; }
  }
  return best;
}

export const BONUS_MIN_GAP = 12;   // spawns since last bonus before eligible
export const BONUS_CHANCE = 0.08;  // per-eligible-spawn probability (~1 in 12.5)

// Pure bonus-spawn decision. `rng` returns a number in [0,1) (scene passes
// Math.random; tests pass a stub). Enforces a minimum gap so the rainbow
// bonus is a periodic surprise, never back-to-back.
export function shouldSpawnBonus(spawnsSinceBonus: number, rng: () => number): boolean {
  if (spawnsSinceBonus < BONUS_MIN_GAP) return false;
  return rng() < BONUS_CHANCE;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/pop.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Verify the whole suite + typecheck**

Run: `npm test` (expect 56 + 8 = 64 passing) and `npx tsc --noEmit` (no output).

- [ ] **Step 6: Commit**

```bash
git add src/core/pop.ts src/core/pop.test.ts
git commit -m "feat(pop): pure nearest-target + bonus-spawn helpers"
```

---

### Task 2: Underwater background — `src/scenes/ui/UnderwaterBackground.ts`

**Files:**
- Create: `src/scenes/ui/UnderwaterBackground.ts`

**Interfaces:**
- Consumes: nothing (mirrors `SpaceBackground`'s shape).
- Produces: `class UnderwaterBackground extends Phaser.GameObjects.Container` with `constructor(scene, width, height)`, `resize(width, height): void`, `update(dt: number, _width: number): void`.

- [ ] **Step 1: Write the implementation**

Create `src/scenes/ui/UnderwaterBackground.ts` (shape-based — no runtime-generated textures, avoiding the Phaser-4 blank-texture gotcha; mirrors `SpaceBackground.ts`):

```ts
import Phaser from "phaser";

// Shape-based underwater background for Pop the Cuties: a teal->aqua gradient
// with translucent bubbles drifting upward and soft light rays. Distinct from
// the meadow (CatchBackground), starfield (SpaceBackground), and rainbow sky
// (Background). Motion is calm and low-contrast so it never competes with the
// poppable cuties the child is tracking.
export class UnderwaterBackground extends Phaser.GameObjects.Container {
  private water: Phaser.GameObjects.Graphics;
  private rays: Phaser.GameObjects.Graphics;
  private bubbles: Phaser.GameObjects.Arc[] = [];
  private bubbleSpeed: number[] = [];
  private _t = 0;
  private _w = 0;
  private _h = 0;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(-10);

    this.water = scene.add.graphics();
    this.add(this.water);
    this.rays = scene.add.graphics();
    this.add(this.rays);

    for (let i = 0; i < 26; i++) {
      const b = scene.add.circle(0, 0, 4 + Math.random() * 12, 0xffffff, 0.18);
      this.bubbles.push(b);
      this.bubbleSpeed.push(20 + Math.random() * 50);
      this.add(b);
    }

    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this._w = width;
    this._h = height;
    // Teal -> aqua vertical gradient via stacked bands.
    this.water.clear();
    const bands = [0x015c6b, 0x027a86, 0x089aa0, 0x36b9b3, 0x73d6c8];
    const bandH = height / bands.length;
    bands.forEach((c, i) => this.water.fillStyle(c, 1).fillRect(0, i * bandH, width, bandH + 1));
    for (const b of this.bubbles) b.setPosition(Math.random() * width, Math.random() * height);
    this.drawRays();
  }

  private drawRays(): void {
    this.rays.clear();
    const n = 4;
    for (let i = 0; i < n; i++) {
      const x = (this._w / n) * (i + 0.5) + Math.sin(this._t * 0.3 + i) * 40;
      this.rays.fillStyle(0xffffff, 0.05);
      this.rays.fillTriangle(x, -50, x + 140, -50, x - 120, this._h + 50);
    }
  }

  update(dt: number, _width: number): void {
    this._t += dt;
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      b.y -= this.bubbleSpeed[i] * dt;
      b.x += Math.sin(this._t * 1.5 + i) * 8 * dt;
      if (b.y < -20) { b.y = this._h + 20; b.x = Math.random() * this._w; }
    }
    this.drawRays();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (note: `_width` is intentionally unused to match the existing `update(dt, _width)` signature; the leading underscore satisfies `noUnusedParameters`).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/ui/UnderwaterBackground.ts
git commit -m "feat(pop): underwater background (teal gradient, rising bubbles, rays)"
```

---

### Task 3: Dedicated music — download script + Boot load + credits

**Files:**
- Create: `scripts/build-pop-audio.mjs`
- Modify: `package.json` (scripts), `src/scenes/BootScene.ts` (preload), `public/audio/CREDITS.md`, `README.md`
- Generated asset: `public/audio/popmusic.mp3`

**Interfaces:**
- Consumes: nothing.
- Produces: audio key `"popmusic"` loaded in Boot (used by Task 4).

- [ ] **Step 1: Create the download script**

Create `scripts/build-pop-audio.mjs` (mirrors `scripts/build-catch-audio.mjs`; one upbeat CC-BY default that the user can swap):

```js
/**
 * build-pop-audio.mjs
 * Downloads one upbeat royalty-free Kevin MacLeod track (CC-BY) as the default
 * music for Pop the Cuties. Output: public/audio/popmusic.mp3
 * The user can replace this file with their own track (keep the filename).
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-pop-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACK = {
  file: "popmusic.mp3",
  title: "Monkeys Spinning Monkeys",
  url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Monkeys%20Spinning%20Monkeys.mp3",
};

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
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
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
  });
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const dest = join(OUT_DIR, TRACK.file);
  process.stdout.write(`Downloading ${TRACK.title} -> ${TRACK.file} ... `);
  try { await download(TRACK.url, dest); console.log("ok"); }
  catch (e) { console.error(`FAILED: ${e.message} — pick another upbeat CC-BY track and update the URL + CREDITS.md`); process.exitCode = 1; }
}
main();
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"` (after the `"catch-audio"` line):

```json
    "pop-audio": "node scripts/build-pop-audio.mjs",
```

- [ ] **Step 3: Run the script to fetch the asset**

Run: `npm run pop-audio`
Expected: `Downloading Monkeys Spinning Monkeys -> popmusic.mp3 ... ok` and the file exists at `public/audio/popmusic.mp3`.
Verify: `ls -la public/audio/popmusic.mp3` shows a non-trivial file size (> 1 MB).

- [ ] **Step 4: Load the track in Boot**

In `src/scenes/BootScene.ts` `preload()`, add after the `this.load.audio("title", ...)` line:

```ts
    this.load.audio("popmusic", ["audio/popmusic.mp3"]);
```

- [ ] **Step 5: Credit the track**

In `public/audio/CREDITS.md`, add a line for the Pop mode track in the same style as the existing entries, e.g.:

```markdown
- popmusic.mp3 — "Monkeys Spinning Monkeys" by Kevin MacLeod (incompetech.com), CC-BY 4.0. Default track for Pop the Cuties; user-swappable.
```

- [ ] **Step 6: Note it in the README**

In `README.md`, add `npm run pop-audio` alongside the other asset-build scripts, and mention the third mode in the modes/notes section (one line, matching the existing tone).

- [ ] **Step 7: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass; the build precaches `popmusic.mp3`.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-pop-audio.mjs package.json src/scenes/BootScene.ts public/audio/CREDITS.md public/audio/popmusic.mp3 README.md
git commit -m "feat(pop): dedicated music track (download script + Boot load + credits)"
```

---

### Task 4: PopScene + title button + scene registration

**Files:**
- Create: `src/scenes/PopScene.ts`
- Modify: `src/main.ts` (register scene), `src/scenes/TitleScene.ts` (third button)

**Interfaces:**
- Consumes:
  - `src/core/pop.ts`: `pickNearestWithinRadius(px, py, targets, radius): number`, `shouldSpawnBonus(spawnsSinceBonus, rng): boolean`.
  - `src/core/catch.ts`: `initialCatchState()`, `recordCatch(s)`, `recordMiss(s)`, `speedForNotch(notch)`, `type CatchState`.
  - `src/render/emojiSprite.ts`: `spawnEmoji(scene, x, y, type): Sprite`, `resetEmoji(sprite, type, x, y): Sprite`.
  - `src/render/sprites.ts`: `ATLAS_KEY`, `frameFor(name): string`.
  - `src/audio/sound.ts`: `class Sound` with `fanfare()`, `tada()`.
  - `src/scenes/ui/Celebrations.ts`: `class Celebrations` with `bigParty()`, `banner(text)`.
  - `src/scenes/ui/UnderwaterBackground.ts` (Task 2).
- Produces: scene key `"Pop"`, started by the title button.

- [ ] **Step 1: Create the scene**

Create `src/scenes/PopScene.ts`:

```ts
import Phaser from "phaser";
import { UnderwaterBackground } from "./ui/UnderwaterBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { Sound } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { initialCatchState, recordCatch, recordMiss, speedForNotch, type CatchState } from "../core/catch";
import { pickNearestWithinRadius, shouldSpawnBonus } from "../core/pop";

const SPAWN_INTERVAL = 0.9;          // seconds, fixed (independent of float speed)
const MAX_CONCURRENT = 12;           // cap on-screen cuties
const POP_RADIUS = 90;               // generous tap radius (~1.5x sprite)
const CELEBRATION_EVERY = 20;        // pops per milestone celebration
const ITEM_SCALE = 1.1;
const BONUS_SCALE = 1.8;
const BURST_PARTICLES = 12;
const BURST_PARTICLES_REDUCED = 4;

// Cute, non-disappearing types (keys from src/render/emoji.ts; note icecream/
// donut/cupcake/lollipop now render tulip/ladybug/clover/cat). No cloud.
const POP_ITEM_TYPES = ["star", "heart", "flower", "butterfly", "gem", "balloon", "icecream", "donut", "cupcake", "lollipop"];

// Rainbow tint cycle for the bonus cutie (ROYGBIV).
const RAINBOW_COLORS = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00a3ff, 0x5e5ce6, 0xaf52de];

export class PopScene extends Phaser.Scene {
  private bg!: UnderwaterBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;

  private cuties!: Phaser.GameObjects.Group;
  private spawnTimer = 0;
  private spawnsSinceBonus = 0;
  private _t = 0;

  private state: CatchState = initialCatchState();
  private popCount = 0;
  private celebratedUpTo = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private reduceMotion = false;

  constructor() { super("Pop"); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.reduceMotion = (typeof window !== "undefined" && window.matchMedia)
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

    this.bg = new UnderwaterBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.fx = new Celebrations(this);

    // Shared, pooled particle burst (sparkle frame from the OpenMoji atlas).
    this.burst = this.add.particles(0, 0, ATLAS_KEY, {
      frame: frameFor("sparkle"),
      speed: { min: 120, max: 280 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 420,
      quantity: 1,
      emitting: false,
    }).setDepth(50);

    this.state = initialCatchState();
    this.popCount = 0;
    this.celebratedUpTo = 0;
    this.spawnTimer = 0;
    this.spawnsSinceBonus = 0;
    this._t = 0;

    this.cuties = this.add.group();

    // Dedicated looping music (quieter so the pop SFX stay crisp). Robust autoplay
    // (immediate + delayed retry + unlock/first-tap), stopped on shutdown.
    const music = this.sound.add("popmusic", { loop: true, volume: 0.38 });
    const startMusic = () => { if (!music.isPlaying) music.play(); };
    startMusic();
    this.time.delayedCall(200, startMusic);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    this.input.once("pointerdown", startMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { music.stop(); this.sound.stopAll(); });

    // Multi-touch: up to 4 simultaneous fingers; each pops the nearest cutie.
    this.input.addPointer(3);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.tryPop(p.worldX, p.worldY));

    this.scoreText = this.add.text(24, 24, "⭐ 0", {
      fontSize: "44px", color: "#ffffff", fontStyle: "bold", stroke: "#075e63", strokeThickness: 6,
    }).setDepth(1000);

    // Back to title (top-right) — no game-over otherwise.
    const back = this.add.text(W - 24, 24, "⬅", { fontSize: "44px" }).setOrigin(1, 0).setDepth(1000)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("Title"));
  }

  private spawnCutie() {
    const W = this.scale.width, H = this.scale.height;
    const x = 80 + Math.random() * (W - 160);
    const isBonus = shouldSpawnBonus(this.spawnsSinceBonus, Math.random);
    const type = isBonus ? "gem" : POP_ITEM_TYPES[Math.floor(Math.random() * POP_ITEM_TYPES.length)];

    let c = this.cuties.getFirstDead(false) as Phaser.GameObjects.Sprite | null;
    if (!c) {
      c = spawnEmoji(this, x, H + 40, type);
      this.cuties.add(c);
    } else {
      this.tweens.killTweensOf(c);
      resetEmoji(c, type, x, H + 40);
    }
    c.setScale(isBonus ? BONUS_SCALE : ITEM_SCALE).setAlpha(1).setAngle(0).clearTint();
    c.setData("baseX", x);
    c.setData("swayPhase", Math.random() * Math.PI * 2);
    c.setData("swayFreq", 1.5 + Math.random() * 1.5);
    c.setData("swayAmp", 20 + Math.random() * 30);
    c.setData("speedMul", 0.85 + Math.random() * 0.3);
    c.setData("bonus", isBonus);

    if (isBonus) {
      this.spawnsSinceBonus = 0;
      // Rainbow colour-cycle + gentle pulse so it reads as special.
      this.tweens.addCounter({
        from: 0, to: RAINBOW_COLORS.length, duration: 1400, repeat: -1,
        onUpdate: (tw) => { if (c!.active) c!.setTint(RAINBOW_COLORS[Math.floor(tw.getValue()) % RAINBOW_COLORS.length]); },
      });
      this.tweens.add({ targets: c, scale: BONUS_SCALE * 1.12, yoyo: true, repeat: -1, duration: 520, ease: "Sine.inOut" });
    } else {
      this.spawnsSinceBonus += 1;
    }
  }

  private explodeBurst(x: number, y: number) {
    this.burst.explode(this.reduceMotion ? BURST_PARTICLES_REDUCED : BURST_PARTICLES, x, y);
  }

  // Pop a single cutie: count it, burst + sound, squash, recycle.
  private popOne(c: Phaser.GameObjects.Sprite) {
    c.setActive(false);
    this.tweens.killTweensOf(c);
    this.popCount += 1;
    this.state = recordCatch(this.state);
    this.scoreText.setText(`⭐ ${this.popCount}`);
    this.explodeBurst(c.x, c.y);
    this.sound.play("pop", { detune: Phaser.Math.Between(-120, 120), volume: 0.6 });
    this.tweens.add({
      targets: c, scaleX: c.scaleX * 1.4, scaleY: c.scaleY * 0.6, alpha: 0,
      duration: 140, ease: "Back.easeIn", onComplete: () => this.cuties.killAndHide(c),
    });
  }

  private tryPop(px: number, py: number) {
    const actives = (this.cuties.getChildren() as Phaser.GameObjects.Sprite[]).filter((c) => c.active);
    if (!actives.length) return;
    const idx = pickNearestWithinRadius(px, py, actives.map((c) => ({ x: c.x, y: c.y })), POP_RADIUS);
    if (idx < 0) return;
    const hit = actives[idx];
    if (hit.getData("bonus")) this.popBonus(hit);
    else { this.popOne(hit); this.milestoneCheck(); }
  }

  // Bonus pop: the bonus counts +1, then clears every other active cutie
  // (each counts +1), then one big party + a single milestone check.
  private popBonus(bonus: Phaser.GameObjects.Sprite) {
    this.popOne(bonus);
    (this.cuties.getChildren() as Phaser.GameObjects.Sprite[])
      .filter((c) => c.active && c !== bonus)
      .forEach((c) => this.popOne(c));
    this.party();
    this.sound2.tada();
    if (!this.reduceMotion) this.cameras.main.shake(220, 0.004);
    this.milestoneCheck();
  }

  private party() {
    if (this.reduceMotion) { this.fx.banner("🌈"); }
    else { this.fx.bigParty(); this.fx.banner("🌈"); }
  }

  private milestoneCheck() {
    const m = Math.floor(this.popCount / CELEBRATION_EVERY);
    if (m > this.celebratedUpTo) {
      this.celebratedUpTo = m;
      this.party();
      this.sound2.fanfare();
    }
  }

  // A cutie reached the top un-popped: gentle float-away wave, counts as a miss.
  private escape(c: Phaser.GameObjects.Sprite) {
    c.setActive(false);
    this.tweens.killTweensOf(c);
    this.state = recordMiss(this.state);
    this.tweens.add({
      targets: c, y: c.y - 36, alpha: 0, angle: 12,
      duration: 300, ease: "Sine.easeOut", onComplete: () => this.cuties.killAndHide(c),
    });
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this._t += dt;
    this.bg.update(dt, this.scale.width);

    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL) {
      this.spawnTimer = 0;
      if (this.cuties.countActive(true) < MAX_CONCURRENT) this.spawnCutie();
    }

    const speed = speedForNotch(this.state.notch);
    (this.cuties.getChildren() as Phaser.GameObjects.Sprite[]).forEach((c) => {
      if (!c.active) return;
      c.y -= speed * (c.getData("speedMul") as number) * dt;
      c.x = (c.getData("baseX") as number)
        + Math.sin(this._t * (c.getData("swayFreq") as number) + (c.getData("swayPhase") as number)) * (c.getData("swayAmp") as number);
      if (c.y < -60) this.escape(c);
    });
  }
}
```

- [ ] **Step 2: Register the scene**

In `src/main.ts`: add the import after the `CatchScene` import —

```ts
import { PopScene } from "./scenes/PopScene";
```

— and add `PopScene` to the end of the `scene` array:

```ts
  scene: [BootScene, TitleScene, GameScene, CatchScene, PopScene],
```

- [ ] **Step 3: Add the title button**

In `src/scenes/TitleScene.ts` `create()`, after the existing Rainbow Catch button line, add:

```ts
    this.makeButton(W / 2, 1040, "🫧  Pop the Cuties", 0xff5fa2, () => this.scene.start("Pop"));
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. (If `this.add.particles(...)`'s return type doesn't match `Phaser.GameObjects.Particles.ParticleEmitter` in the installed Phaser 4 typings, adjust the field type to the type `add.particles` returns — do not change behavior.)

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Full test suite**

Run: `npm test`
Expected: 64 passing (unchanged — no scene tests).

- [ ] **Step 7: Runtime verification (Claude Preview)**

Start the dev server and open the game. Verify by evaluating against `window.__game` and/or screenshots:
- The title shows a third pink button "🫧 Pop the Cuties"; tapping it starts the `Pop` scene.
- Cuties rise from the bottom with a gentle side-to-side sway and **keep animating** (never vanish).
- Tapping a cutie pops it: a sparkle particle burst at the point, a pop sound, the count (top-left) increments.
- Letting cuties reach the top does a small float-away (no error), and sustained popping vs sustained escapes audibly/visibly changes the rise speed.
- The underwater background animates (rising bubbles); music loops; the ⬅ button returns to the title.
- `preview_console_logs` shows no errors.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/PopScene.ts src/main.ts src/scenes/TitleScene.ts
git commit -m "feat(pop): PopScene (tap-to-pop, multitouch, bonus, celebrations) + title button"
```

---

## Self-Review

**1. Spec coverage** (against `docs/superpowers/specs/2026-06-26-pop-the-cuties-design.md`):
- §2.1 title button + back button → Task 4 (button), PopScene back button. ✅
- §2.2 rising cuties + sway + tap pops + count → Task 4. ✅
- §2.3 multi-touch nearest-within-radius → Task 1 (`pickNearestWithinRadius`) + Task 4 (`addPointer(3)`, scene-level `pointerdown`). ✅
- §2.4 self-balancing speed reuse → Task 4 uses `catch.ts`. ✅
- §2.5 no-fail + escape wave → Task 4 `escape()`. ✅
- §2.6 milestone every 20 → Task 4 `milestoneCheck()`. ✅
- §2.7 rainbow bonus clears screen → Task 4 `popBonus()` + `shouldSpawnBonus` (Task 1). ✅
- §2.8 underwater background + dedicated music → Task 2 + Task 3. ✅
- §2.9 reduced motion → Task 4 `reduceMotion` (fewer particles, no shake, gentler party). ✅
- §2.10 pure module + tests; existing modes untouched → Task 1; no edits to Game/Catch scenes. ✅
- §5.3 burst + squash + detuned pop → Task 4. ✅

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✅

**3. Type consistency:** `pickNearestWithinRadius`/`shouldSpawnBonus`/`TargetLike` signatures match between Task 1 and Task 4's Interfaces/usage; `catch.ts` names (`initialCatchState`, `recordCatch`, `recordMiss`, `speedForNotch`, `CatchState`) match the real module; `spawnEmoji`/`resetEmoji`, `ATLAS_KEY`/`frameFor`, `Sound.fanfare()/tada()`, `Celebrations.bigParty()/banner()`, `UnderwaterBackground(scene,w,h)/update(dt,w)` all match. ✅

No gaps found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-26-pop-the-cuties.md`.
