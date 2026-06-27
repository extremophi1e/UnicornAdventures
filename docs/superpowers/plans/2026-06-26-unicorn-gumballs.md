# Unicorn Gumballs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth game mode, "Unicorn Gumballs" — a surprise machine: tap a giant button → the rainbow machine rattles + flashes → a random cutie tumbles out → confetti + fanfare, with a rare unicorn jackpot.

**Architecture:** A standalone `Phaser.Scene` (`GumballScene`) drives a timed reveal with `this.time.delayedCall` + concurrent tweens (Phaser 4 removed `Timeline`; `tweens.chain` has a top-level-delay bug). A pure `src/core/gumballs.ts` shuffle-bag (no-immediate-repeat + seeded jackpot) is the only logic, unit-tested with Vitest. Rendering reuses the animated-emoji cuties, the `catchUnicorn` sprite (jackpot), the OpenMoji `sparkle` particle burst, and the `Celebrations`/`Sound` helpers.

**Tech Stack:** Phaser 4 (WebGL), TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), Vite, Vitest, Node/https build scripts. No new runtime dependencies.

## Global Constraints

- **No new runtime dependencies** — reuse Phaser 4 + existing helpers only.
- **Sequencing:** `this.time.delayedCall` + concurrent tweens — NOT Phaser `Timeline` (removed in 4.x) or `tweens.chain` (top-level-delay bug).
- **Pure logic is Vitest-tested**; scenes/backgrounds are not unit-tested (verified by running the game).
- **Existing modes (Game, Catch, Pop) must be untouched** behaviorally.
- **No-fail, pure sandbox:** no score/count/collection/persistence.
- **Photosensitivity-safe:** any flashing ≤ 2 cycles/sec, no saturated red, small area; honor `prefers-reduced-motion` (replace rattle/flash with a gentle glow-pulse; reveal + confetti still play).
- **Exact names/values:** scene key `"Gumball"`; title button label `"🎁  Unicorn Gumballs"`, color `0xff9f43`, → `this.go("Gumball")`; the four title buttons re-spaced to y 700/850/1000/1150. `JACKPOT_MIN_GAP = 8`, `JACKPOT_CHANCE = 0.10`, jackpot id `"unicorn"`.
- Cutie ids are the existing keys from `src/render/emoji.ts` (note `icecream`/`donut`/`cupcake`/`lollipop` render tulip/ladybug/clover/cat).
- **TypeScript compiles** (`npx tsc --noEmit`), **`npm run build`** passes, and the suite (currently 66 tests) stays green for every task.

---

### Task 1: Pure logic — `src/core/gumballs.ts` (+ tests)

**Files:**
- Create: `src/core/gumballs.ts`
- Test: `src/core/gumballs.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no imports).
- Produces:
  - `const GUMBALL_ITEMS: readonly string[]` (the 11 cutie ids)
  - `const JACKPOT = "unicorn"`, `const JACKPOT_MIN_GAP = 8`, `const JACKPOT_CHANCE = 0.10`
  - `interface Bag { next(): string; }`
  - `createBag(rng: () => number): Bag` — shuffle-bag draw with no-immediate-repeat + seeded jackpot.

- [ ] **Step 1: Write the failing tests**

Create `src/core/gumballs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createBag, GUMBALL_ITEMS, JACKPOT, JACKPOT_MIN_GAP, JACKPOT_CHANCE } from "./gumballs";

describe("createBag", () => {
  it("never returns the same value twice in a row", () => {
    const bag = createBag(Math.random);
    let prev = "";
    for (let i = 0; i < 1000; i++) {
      const x = bag.next();
      expect(x).not.toBe(prev);
      prev = x;
    }
  });

  it("eventually yields every ordinary cutie", () => {
    const bag = createBag(Math.random);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const x = bag.next();
      if (x !== JACKPOT) seen.add(x);
    }
    for (const id of GUMBALL_ITEMS) expect(seen.has(id)).toBe(true);
  });

  it("never gives a jackpot before JACKPOT_MIN_GAP ordinary pulls, then does when eligible", () => {
    const bag = createBag(() => 0); // 0 < JACKPOT_CHANCE, so jackpot fires as soon as eligible
    const out: string[] = [];
    for (let i = 0; i < 12; i++) out.push(bag.next());
    // first JACKPOT_MIN_GAP draws are ordinary, the next is the jackpot
    for (let i = 0; i < JACKPOT_MIN_GAP; i++) expect(out[i]).not.toBe(JACKPOT);
    expect(out[JACKPOT_MIN_GAP]).toBe(JACKPOT);
  });

  it("never fires a jackpot when rng is above the chance", () => {
    const bag = createBag(() => 0.5); // 0.5 > JACKPOT_CHANCE
    for (let i = 0; i < 60; i++) expect(bag.next()).not.toBe(JACKPOT);
  });

  it("never returns two jackpots back to back", () => {
    const bag = createBag(() => 0); // greedy jackpots whenever eligible
    let prevWasJackpot = false;
    for (let i = 0; i < 60; i++) {
      const isJackpot = bag.next() === JACKPOT;
      expect(isJackpot && prevWasJackpot).toBe(false);
      prevWasJackpot = isJackpot;
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/gumballs.test.ts`
Expected: FAIL — `Failed to resolve import "./gumballs"`.

- [ ] **Step 3: Write the implementation**

Create `src/core/gumballs.ts`:

```ts
// Pure, framework-free "surprise" picker for Unicorn Gumballs. No Phaser imports;
// unit-tested headlessly. A shuffle-bag gives no-immediate-repeat cuties with
// bounded droughts; the unicorn jackpot is a gated periodic surprise.

// Ordinary cuties — keys from src/render/emoji.ts (icecream/donut/cupcake/lollipop
// render tulip/ladybug/clover/cat).
export const GUMBALL_ITEMS: readonly string[] = [
  "star", "heart", "flower", "butterfly", "gem", "balloon",
  "icecream", "donut", "cupcake", "lollipop", "cloud",
];
export const JACKPOT = "unicorn";   // special: rendered from the catchUnicorn sheet
export const JACKPOT_MIN_GAP = 8;   // ordinary pulls required before a jackpot is eligible
export const JACKPOT_CHANCE = 0.10; // per-eligible-pull probability (~1 in 16 overall)

export interface Bag {
  next(): string;
}

function shuffle(items: readonly string[], rng: () => number): string[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

export function createBag(rng: () => number): Bag {
  let bag: string[] = [];
  let last: string | null = null;
  let sinceJackpot = 0;

  const drawCutie = (): string => {
    if (bag.length === 0) {
      bag = shuffle(GUMBALL_ITEMS, rng);
      // De-seam: the item we're about to draw (end of the array) must not repeat
      // the previous draw across a refill boundary.
      if (bag.length > 1 && bag[bag.length - 1] === last) {
        const t = bag[bag.length - 1]; bag[bag.length - 1] = bag[0]; bag[0] = t;
      }
    }
    const x = bag.pop() as string;
    last = x;
    return x;
  };

  return {
    next(): string {
      if (sinceJackpot >= JACKPOT_MIN_GAP && rng() < JACKPOT_CHANCE) {
        sinceJackpot = 0;
        return JACKPOT;
      }
      sinceJackpot += 1;
      return drawCutie();
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/gumballs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify the whole suite + typecheck**

Run: `npm test` (expect 66 + 5 = 71 passing) and `npx tsc --noEmit` (no output).

- [ ] **Step 6: Commit**

```bash
git add src/core/gumballs.ts src/core/gumballs.test.ts
git commit -m "feat(gumballs): pure shuffle-bag picker with seeded jackpot"
```

---

### Task 2: Cozy playroom background — `src/scenes/ui/PlayroomBackground.ts`

**Files:**
- Create: `src/scenes/ui/PlayroomBackground.ts`

**Interfaces:**
- Consumes: nothing (mirrors the other `ui/*Background.ts` components).
- Produces: `class PlayroomBackground extends Phaser.GameObjects.Container` with `constructor(scene, width, height)`, `resize(width, height): void`, `update(dt: number, _width: number): void`.

- [ ] **Step 1: Write the implementation**

Create `src/scenes/ui/PlayroomBackground.ts` (shape-based — no runtime-generated textures; mirrors `SpaceBackground.ts`/`UnderwaterBackground.ts`):

```ts
import Phaser from "phaser";

// Calm cozy-playroom background for Unicorn Gumballs: a warm cream->peach
// gradient with softly drifting polka dots, deliberately low-contrast so the
// busy rainbow machine + flashes read clearly on top.
export class PlayroomBackground extends Phaser.GameObjects.Container {
  private wall: Phaser.GameObjects.Graphics;
  private dots: Phaser.GameObjects.Arc[] = [];
  private dotPhase: number[] = [];
  private _t = 0;
  private _w = 0;
  private _h = 0;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(-10);

    this.wall = scene.add.graphics();
    this.add(this.wall);

    for (let i = 0; i < 22; i++) {
      const d = scene.add.circle(0, 0, 10 + Math.random() * 16, 0xffffff, 0.22);
      this.dots.push(d);
      this.dotPhase.push(Math.random() * Math.PI * 2);
      this.add(d);
    }

    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this._w = width;
    this._h = height;
    // Warm cream -> peach vertical gradient via stacked bands.
    this.wall.clear();
    const bands = [0xfff3e6, 0xffe9d6, 0xffe0cc, 0xffd6c2, 0xffccbb];
    const bandH = height / bands.length;
    bands.forEach((c, i) => this.wall.fillStyle(c, 1).fillRect(0, i * bandH, width, bandH + 1));
    for (const d of this.dots) d.setPosition(Math.random() * width, Math.random() * height);
  }

  update(dt: number, _width: number): void {
    this._t += dt;
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      d.y -= 6 * dt; // very gentle upward drift
      d.x += Math.sin(this._t * 0.6 + this.dotPhase[i]) * 4 * dt;
      if (d.y < -30) { d.y = this._h + 30; d.x = Math.random() * this._w; }
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (`_width` intentionally unused, underscore-prefixed, matching the other backgrounds).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/ui/PlayroomBackground.ts
git commit -m "feat(gumballs): cozy playroom background"
```

---

### Task 3: Dedicated music — download script + Boot load + credits

**Files:**
- Create: `scripts/build-gumball-audio.mjs`
- Modify: `package.json`, `src/scenes/BootScene.ts`, `public/audio/CREDITS.md`, `README.md`
- Generated asset: `public/audio/gumball.mp3`

**Interfaces:**
- Consumes: nothing.
- Produces: audio key `"gumball"` loaded in Boot (used by Task 4).

- [ ] **Step 1: Create the download script**

Create `scripts/build-gumball-audio.mjs` (mirrors `scripts/build-pop-audio.mjs`):

```js
/**
 * build-gumball-audio.mjs
 * Downloads one upbeat royalty-free Kevin MacLeod track (CC-BY) as the default
 * music for Unicorn Gumballs. Output: public/audio/gumball.mp3
 * The user can replace this file with their own track (keep the filename).
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-gumball-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACK = {
  file: "gumball.mp3",
  title: "The Builder",
  url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Builder.mp3",
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

In `package.json`, add to `"scripts"` after the `"pop-audio"` line:

```json
    "gumball-audio": "node scripts/build-gumball-audio.mjs",
```

- [ ] **Step 3: Run the script to fetch the asset**

Run: `npm run gumball-audio`
Expected: `Downloading The Builder -> gumball.mp3 ... ok` and `public/audio/gumball.mp3` exists (> 1 MB: `ls -la public/audio/gumball.mp3`).
If the download fails (no network / dead URL), that is non-fatal: keep the script + edits, do NOT stage a partial mp3, and report DONE_WITH_CONCERNS noting the asset wasn't fetched (the controller will fetch/replace it).

- [ ] **Step 4: Load the track in Boot**

In `src/scenes/BootScene.ts` `preload()`, add immediately after the `this.load.audio("popmusic", ["audio/popmusic.mp3"]);` line:

```ts
    this.load.audio("gumball", ["audio/gumball.mp3"]);
```

- [ ] **Step 5: Credit the track**

In `public/audio/CREDITS.md`, add a row in the music table (match the existing column style):

```markdown
| gumball.mp3 | The Builder              | https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Builder.mp3            | CC-BY 4.0 |
```

- [ ] **Step 6: Note it in the README**

In `README.md`, add `npm run gumball-audio` to the asset-build scripts table and update the modes description from three games to four (one line, matching the existing tone).

- [ ] **Step 7: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass; the build precaches `gumball.mp3`.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-gumball-audio.mjs package.json src/scenes/BootScene.ts public/audio/CREDITS.md public/audio/gumball.mp3 README.md
git commit -m "feat(gumballs): dedicated music track (download script + Boot load + credits)"
```

---

### Task 4: GumballScene + title button + scene registration

**Files:**
- Create: `src/scenes/GumballScene.ts`
- Modify: `src/main.ts` (register scene), `src/scenes/TitleScene.ts` (4th button + re-space)

**Interfaces:**
- Consumes:
  - `src/core/gumballs.ts`: `createBag(rng): Bag`, `JACKPOT`.
  - `src/render/emojiSprite.ts`: `spawnEmoji(scene, x, y, type)`, `resetEmoji(sprite, type, x, y)`.
  - `src/render/sprites.ts`: `ATLAS_KEY`, `frameFor(name)`.
  - `src/render/catchUnicorn.ts`: `CATCH_UNICORN_KEY`, `CATCH_UNICORN_ANIM`.
  - `src/audio/sound.ts`: `class Sound` (`fanfare()`, `tada()`, `pop()`).
  - `src/scenes/ui/Celebrations.ts`: `class Celebrations` (`bigParty()`, `banner(text)`, `popAt(x,y)`).
  - `src/scenes/ui/PlayroomBackground.ts` (Task 2).
  - `TitleScene.go(key)` already exists (used by the other buttons).
- Produces: scene key `"Gumball"`, started by the title button.

- [ ] **Step 1: Create the scene**

Create `src/scenes/GumballScene.ts`:

```ts
import Phaser from "phaser";
import { PlayroomBackground } from "./ui/PlayroomBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM } from "../render/catchUnicorn";
import { Sound } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { createBag, JACKPOT, type Bag } from "../core/gumballs";

const ANTICIPATION_MS = 1100;        // rattle + flash before the reveal
const FLASH_INTERVAL_MS = 260;       // toggle every 260ms -> ~1.9 flashes/sec (seizure-safe)
const BURST_PARTICLES = 16;
const BURST_PARTICLES_REDUCED = 5;
const ITEM_REVEAL_SCALE = 2.2;       // emoji frame is 72px
const JACKPOT_REVEAL_SCALE = 0.85;   // catchUnicorn frame is 256px
const RAINBOW_COLORS = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00a3ff, 0x5e5ce6, 0xaf52de];
const BULB_DIM = 0xcfd8e0;

export class GumballScene extends Phaser.Scene {
  private bg!: PlayroomBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bag!: Bag;
  private reduceMotion = false;
  private busy = false;
  private _t = 0;

  private machine!: Phaser.GameObjects.Container;
  private machineBaseX = 0;
  private bulbs: Phaser.GameObjects.Arc[] = [];
  private bulbsLit = false;
  private globeCuties: Phaser.GameObjects.Sprite[] = [];
  private button!: Phaser.GameObjects.Container;
  private wiggle?: Phaser.Tweens.Tween;
  private rattle?: Phaser.Tweens.Tween;
  private flashEvent?: Phaser.Time.TimerEvent;
  private glow!: Phaser.GameObjects.Rectangle;

  private chuteX = 0;
  private chuteY = 0;
  private revealY = 0;
  private item!: Phaser.GameObjects.Sprite;          // pooled revealed cutie (one at a time)
  private jackpotSprite!: Phaser.GameObjects.Sprite; // the unicorn for jackpots

  constructor() { super("Gumball"); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.reduceMotion = (typeof window !== "undefined" && window.matchMedia)
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

    this.bg = new PlayroomBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.fx = new Celebrations(this);
    this.bag = createBag(Math.random);
    this.busy = false;
    this._t = 0;

    this.burst = this.add.particles(0, 0, ATLAS_KEY, {
      frame: frameFor("sparkle"), speed: { min: 140, max: 320 }, angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 500, quantity: 1, emitting: false,
    }).setDepth(60);

    this.glow = this.add.rectangle(W / 2, H / 2, W, H, 0xff7fbf, 0).setDepth(55);

    this.buildMachine(W, H);
    this.buildButton(W, H);

    // Pooled revealed cutie + the jackpot unicorn (both hidden until used).
    this.item = this.add.sprite(this.chuteX, this.chuteY, "emoji-star").setVisible(false).setDepth(50);
    this.jackpotSprite = this.add.sprite(this.chuteX, this.chuteY, CATCH_UNICORN_KEY).setVisible(false).setDepth(50);

    // Dedicated looping music (low volume), robust autoplay, stopped on shutdown.
    const music = this.sound.add("gumball", { loop: true, volume: 0.38 });
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

  private buildMachine(W: number, H: number) {
    const mx = W / 2, my = H * 0.34;
    this.machineBaseX = mx;
    const c = this.add.container(mx, my).setDepth(10);

    const g = this.add.graphics();
    // Base + foot.
    g.fillStyle(0xdfe6ee, 1).fillRoundedRect(-120, 90, 240, 150, 24);
    g.fillStyle(0xb9c4d0, 1).fillRoundedRect(-140, 230, 280, 26, 12);
    // Chute opening.
    g.fillStyle(0x3a3f47, 1).fillRoundedRect(-44, 150, 88, 44, 10);
    // Glass globe.
    g.fillStyle(0xffffff, 0.18).fillCircle(0, -30, 150);
    g.lineStyle(8, 0xffffff, 0.55).strokeCircle(0, -30, 150);
    // Rainbow dome: nested top-half semicircles, largest first.
    for (let i = 0; i < RAINBOW_COLORS.length; i++) {
      const r = 116 - i * 15;
      g.fillStyle(RAINBOW_COLORS[i], 1);
      g.slice(0, -150, r, Math.PI, 0, true);
      g.fillPath();
    }
    c.add(g);

    // Bulbs around the globe.
    for (let i = 0; i < 6; i++) {
      const ang = -Math.PI * 0.85 + (i / 5) * (Math.PI * 1.7);
      const b = this.add.circle(Math.cos(ang) * 168, -30 + Math.sin(ang) * 168, 13, BULB_DIM, 1);
      this.bulbs.push(b);
      c.add(b);
    }

    // A few cuties jumbling inside the globe.
    const insideTypes = ["star", "heart", "gem", "flower", "balloon"];
    for (let i = 0; i < insideTypes.length; i++) {
      const bx = (Math.random() - 0.5) * 160;
      const by = -30 + (Math.random() - 0.5) * 150;
      const s = spawnEmoji(this, 0, 0, insideTypes[i]).setScale(0.5);
      s.setData("baseX", bx).setData("baseY", by);
      s.setPosition(bx, by);
      this.globeCuties.push(s);
      c.add(s);
    }

    this.machine = c;
    this.chuteX = mx;
    this.chuteY = my + 172;
    this.revealY = my + 300;
  }

  private buildButton(W: number, H: number) {
    const bx = W / 2, by = H * 0.80, r = 120;
    const g = this.add.graphics();
    g.fillStyle(0xff5fa2, 1).fillCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.25).fillCircle(0, -r * 0.32, r * 0.55);
    const label = this.add.text(0, 0, "👆", { fontSize: "84px" }).setOrigin(0.5);
    this.button = this.add.container(bx, by, [g, label]).setDepth(40);
    // Generous rectangular hit area via a separate zone (reliable for containers).
    const zone = this.add.zone(bx, by, (r + 30) * 2, (r + 30) * 2).setDepth(40).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.pull());
  }

  private pull() {
    if (this.busy) return;
    this.busy = true;
    this.sound2.pop();
    // Button squash, then a continuous wiggle while locked so it never looks frozen.
    this.tweens.add({ targets: this.button, scaleX: 1.12, scaleY: 0.9, duration: 90, yoyo: true, ease: "Sine.inOut" });
    this.wiggle = this.tweens.add({ targets: this.button, angle: { from: -4, to: 4 }, duration: 140, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    if (this.reduceMotion) {
      // Gentle single glow-pulse instead of rattle/flash.
      this.tweens.add({ targets: this.glow, alpha: { from: 0, to: 0.12 }, duration: 300, yoyo: true });
      this.time.delayedCall(500, () => this.reveal());
    } else {
      this.rattle = this.tweens.add({
        targets: this.machine, x: this.machineBaseX + 10, duration: 60, yoyo: true,
        repeat: Math.floor(ANTICIPATION_MS / 120), ease: "Sine.inOut",
      });
      this.flashEvent = this.time.addEvent({
        delay: FLASH_INTERVAL_MS, repeat: Math.floor(ANTICIPATION_MS / FLASH_INTERVAL_MS),
        callback: () => this.toggleBulbs(),
      });
      this.time.delayedCall(ANTICIPATION_MS, () => this.reveal());
    }
  }

  private toggleBulbs() {
    this.bulbsLit = !this.bulbsLit;
    this.bulbs.forEach((b, i) => b.setFillStyle(this.bulbsLit ? RAINBOW_COLORS[i % RAINBOW_COLORS.length] : BULB_DIM, 1));
  }

  private reveal() {
    this.rattle?.stop(); this.rattle = undefined;
    this.machine.x = this.machineBaseX;
    this.bulbsLit = false; this.bulbs.forEach((b) => b.setFillStyle(BULB_DIM, 1));

    const id = this.bag.next();
    const jackpot = id === JACKPOT;
    const spr = jackpot ? this.jackpotSprite : this.item;
    this.tweens.killTweensOf(this.item);
    this.tweens.killTweensOf(this.jackpotSprite);

    if (jackpot) {
      this.item.setVisible(false);
      spr.setPosition(this.chuteX, this.chuteY).setScale(0).setAlpha(1).setVisible(true).play(CATCH_UNICORN_ANIM);
    } else {
      this.jackpotSprite.setVisible(false);
      resetEmoji(spr, id, this.chuteX, this.chuteY);
      spr.setScale(0).setAlpha(1).setVisible(true);
    }

    const finalScale = jackpot ? JACKPOT_REVEAL_SCALE : ITEM_REVEAL_SCALE;
    this.tweens.add({ targets: spr, y: this.revealY, duration: 480, ease: "Bounce.easeOut" });
    this.tweens.add({
      targets: spr, scale: finalScale, duration: 440, ease: "Back.easeOut",
      onComplete: () => this.payoff(jackpot, spr),
    });
  }

  private payoff(jackpot: boolean, spr: Phaser.GameObjects.Sprite) {
    const x = spr.x, y = spr.y;
    this.burst.explode(this.reduceMotion ? BURST_PARTICLES_REDUCED : BURST_PARTICLES, x, y);
    if (jackpot) {
      this.fx.bigParty();
      this.fx.banner("🌈");
      this.sound2.tada();
      if (!this.reduceMotion) this.tweens.add({ targets: this.glow, alpha: { from: 0, to: 0.22 }, duration: 350, yoyo: true, hold: 250 });
    } else {
      this.fx.popAt(x, y);
      this.sound2.fanfare();
    }
    // Rest, then fade the item out and unlock for the next pull.
    this.time.delayedCall(jackpot ? 1300 : 800, () => {
      this.tweens.add({
        targets: spr, alpha: 0, duration: 250,
        onComplete: () => { spr.setVisible(false); spr.setAlpha(1); },
      });
      this.wiggle?.stop(); this.wiggle = undefined;
      this.button.setAngle(0);
      this.busy = false;
    });
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this._t += dt;
    this.bg.update(dt, this.scale.width);
    // Cuties jumble gently inside the globe.
    for (let i = 0; i < this.globeCuties.length; i++) {
      const s = this.globeCuties[i];
      s.x = (s.getData("baseX") as number) + Math.cos(this._t * 1.6 + i) * 6;
      s.y = (s.getData("baseY") as number) + Math.sin(this._t * 2.0 + i) * 8;
    }
  }
}
```

- [ ] **Step 2: Register the scene**

In `src/main.ts`: add the import after the `PopScene` import —

```ts
import { GumballScene } from "./scenes/GumballScene";
```

— and add `GumballScene` to the end of the `scene` array:

```ts
  scene: [BootScene, TitleScene, GameScene, CatchScene, PopScene, GumballScene],
```

- [ ] **Step 3: Add the title button and re-space the four buttons**

In `src/scenes/TitleScene.ts` `create()`, replace the three `makeButton(...)` lines with these four (re-spaced to fit):

```ts
    this.makeButton(W / 2, 700, "🌈", "Rainbow Shoot", 0x9b6bff, () => this.go("Game"));
    this.makeButton(W / 2, 850, "🌈", "Rainbow Catch", 0x7ed957, () => this.go("Catch"));
    this.makeButton(W / 2, 1000, "🫧", "Pop the Cuties", 0xff5fa2, () => this.go("Pop"));
    this.makeButton(W / 2, 1150, "🎁", "Unicorn Gumballs", 0xff9f43, () => this.go("Gumball"));
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. (If `this.add.particles(...)`'s return type doesn't match `Phaser.GameObjects.Particles.ParticleEmitter` in the installed typings, adjust only that field's type to what `add.particles` returns — same as `PopScene`.)

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Full test suite**

Run: `npm test`
Expected: 71 passing (unchanged — no scene tests).

- [ ] **Step 7: Runtime verification (Claude Preview)**

Start the dev server and verify against `window.__game` / screenshots:
- The title shows four buttons including "🎁 Unicorn Gumballs", all on screen; tapping it starts the `Gumball` scene.
- The rainbow machine renders over the cozy playroom; a few cuties jumble inside the globe; the giant button shows below.
- Tapping the button: button squashes → machine rattles + bulbs flash (≤2/sec) → a cutie tumbles out of the chute (bouncy) → confetti + fanfare. The button is locked (and wiggling) during the pull and re-enables after.
- Repeated pulls never show the same cutie twice in a row; the unicorn jackpot eventually appears with the bigger party + banner.
- `prefers-reduced-motion` swaps the rattle/flash for a glow-pulse (reveal + confetti still play).
- Music loops; `preview_console_logs` shows no errors.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/GumballScene.ts src/main.ts src/scenes/TitleScene.ts
git commit -m "feat(gumballs): GumballScene (rattle/flash/tumble + jackpot) + title button"
```

---

## Self-Review

**1. Spec coverage** (against `docs/superpowers/specs/2026-06-26-unicorn-gumballs-design.md`):
- §2.1 fourth title button + four fit + back button → Task 4. ✅
- §2.2 full sequence (squash → rattle + flash → tumble → confetti + fanfare) → Task 4 `pull`/`reveal`/`payoff`. ✅
- §2.3 button locked but wiggling, re-enables → Task 4 `busy` + `wiggle`. ✅
- §2.4 random cutie no-repeat + rare unicorn jackpot extra party → Task 1 (`createBag`) + Task 4 `reveal`/`payoff`. ✅
- §2.5 pure sandbox / no-fail → no score anywhere. ✅
- §2.6 rainbow machine + playroom bg + dedicated music → Task 4 + Task 2 + Task 3. ✅
- §2.7 reduced-motion + ≤2/sec flashes + no text → Task 4 (`reduceMotion`, `FLASH_INTERVAL_MS` 260ms ≈ 1.9/sec). ✅
- §2.8 pure module + tests; existing modes untouched → Task 1; only additive edits to main/Title/Boot. ✅
- §4.1 shuffle-bag + jackpot constants/behavior → Task 1. ✅
- §5 machine/background/juice → Task 2 + Task 4. ✅
- §7 audio (dedicated `gumball` + reused SFX) → Task 3 + Task 4. ✅

**2. Placeholder scan:** No TBD/TODO; every code step is complete; commands have expected output; the music-download fallback is specified. ✅

**3. Type consistency:** `createBag(rng): Bag`, `JACKPOT`, `GUMBALL_ITEMS` match between Task 1 and Task 4; `spawnEmoji`/`resetEmoji`, `ATLAS_KEY`/`frameFor`, `CATCH_UNICORN_KEY`/`CATCH_UNICORN_ANIM`, `Sound.pop()/fanfare()/tada()`, `Celebrations.bigParty()/banner()/popAt()`, `PlayroomBackground(scene,w,h)/update(dt,w)`, and `TitleScene.go(key)` all match the real modules. ✅

No gaps found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-26-unicorn-gumballs.md`.
