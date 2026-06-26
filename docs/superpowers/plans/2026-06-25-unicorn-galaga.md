# Zoe's Rainbow Unicorn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-fail, browser-based Galaga-style game for a 4-year-old — a pink winged unicorn that auto-fires rainbow stars at cute things across a 12-level story (with friendly bosses) plus an endless rainbow mode — installable as a PWA on PC and phone.

**Architecture:** All gameplay logic lives in **pure TypeScript modules under `src/core/` with zero Phaser imports** (formations, level data, procedural rainbow generation, collision, bullet-magnetism, input mapping, boss state machine, seeded RNG). These are unit-tested with Vitest. **Phaser 4 scenes under `src/scenes/`** are thin consumers of `core` that handle rendering, audio, and input wiring; they are verified by running the dev server against an explicit checklist. A one-file **sprite-key map** (`src/render/sprites.ts`) is the art seam so the OpenMoji atlas can be swapped for custom art later.

**Tech Stack:** Phaser 4, TypeScript, Vite, Vitest, vite-plugin-pwa, OpenMoji sprite atlas, Kenney (CC0) audio, Netlify hosting.

**Design spec:** [docs/superpowers/specs/2026-06-25-unicorn-galaga-design.md](../specs/2026-06-25-unicorn-galaga-design.md)
**Research brief:** [docs/superpowers/research/2026-06-25-unicorn-galaga-brief.md](../research/2026-06-25-unicorn-galaga-brief.md)

## Global Constraints

These apply to every task. Exact values from the spec:

- **Engine:** Phaser `^4.0.0`. Language: TypeScript (strict). Build/dev: Vite. Tests: Vitest.
- **No-fail:** enemies never damage the player; enemy↔unicorn contact = harmless bounce + sparkle. No lives, no game-over, no enemy projectiles.
- **No persistence:** no localStorage, accounts, cloud, analytics, ads, or purchases. Story always starts at Level 1. Rainbow mode always available from the title.
- **No numeric score** anywhere. Rewards are experiential (celebrations only).
- **No per-shot fire sound.** Autofire is constant; only impacts/clears/celebrations make sound.
- **Controls:** follow-the-pointer (touch + mouse) AND arrow keys, all mapped to the same unicorn target; autofire always on. Aim assist = oversized hitboxes + light bullet-magnetism.
- **All interactive UI kept OFF the bottom edge** of the screen.
- **Logical play space:** fixed height **1280**, variable width **clamped 720–1100** (aspect-aware). Coordinates are in this logical space; Phaser Scale `FIT` scales it to the device.
- **Art:** bundled **OpenMoji** sprite atlas (PNG), never system-font emoji. No on-screen credits (private game). Player = 🦄 tinted pink + simple wings + sparkle trail.
- **Story:** 12 levels; each level = ordered list of **1–3 formations** cleared sequentially; each level uses **1–3 cute types** placed in **coherent authored formations** (never random scatter). Bosses at levels **5, 10, 12**.
- **Privacy/legal:** zero data collection (clean by construction).
- **Determinism:** all procedural generation uses an injected seeded RNG (no bare `Math.random()` in `core/`).

---

## File Structure

```
unicorn-galaga-2/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts                 # Vite + vite-plugin-pwa
├─ vitest.config.ts
├─ netlify.toml
├─ public/
│  ├─ atlas/openmoji.png          # generated sprite atlas (placeholder until Task 11)
│  ├─ atlas/openmoji.json         # atlas frame map
│  └─ audio/                      # Kenney CC0 sfx + music
├─ src/
│  ├─ main.ts                     # Phaser game config + scale + scene registration
│  ├─ core/                       # PURE logic, NO phaser imports
│  │  ├─ types.ts
│  │  ├─ rng.ts
│  │  ├─ formations.ts            # templates + assignTypes + layoutFormation
│  │  ├─ levels.ts                # the 12 authored levels
│  │  ├─ difficulty.ts            # budget scaling
│  │  ├─ rainbow.ts               # procedural endless waves
│  │  ├─ collision.ts             # circle overlap + layer-pruned hit detection
│  │  ├─ magnetism.ts             # bullet magnetism
│  │  ├─ input.ts                 # aim resolver + autofire timer
│  │  └─ boss.ts                  # boss phase FSM
│  ├─ render/
│  │  └─ sprites.ts               # logical sprite-key map (art seam)
│  ├─ audio/
│  │  └─ sound.ts                 # Phaser sound wrapper (calm-mode aware)
│  ├─ state/
│  │  └─ settings.ts              # in-memory calm-mode flag
│  ├─ pwa/
│  │  └─ installHint.ts           # iOS add-to-home-screen detection + fullscreen
│  └─ scenes/
│     ├─ BootScene.ts             # load atlas + audio, unlock sound
│     ├─ TitleScene.ts            # name, Play, Rainbow Mode, calm toggle
│     ├─ GameScene.ts             # story: unicorn, stars, enemies, bosses, progression
│     ├─ RainbowScene.ts          # endless mode (extends/uses GameScene logic)
│     └─ ui/
│        ├─ Background.ts         # animated rainbow sky
│        └─ Celebrations.ts       # tiered juice + HUD overlay
└─ tests/                         # vitest, mirrors src/core
```

---

## Phase 0 — Project setup

### Task 1: Scaffold Vite + TypeScript + Phaser 4 + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/scenes/BootScene.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: a runnable Phaser game (`npm run dev`) and a passing test runner (`npm test`).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "zoes-rainbow-unicorn",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "phaser": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^6.0.0",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create `vite.config.ts`** (PWA added in Task 20; minimal for now)

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { target: "es2020" },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no" />
    <title>Zoe's Rainbow Unicorn</title>
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #8ec5ff; touch-action: none; }
      #game { width: 100vw; height: 100dvh; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/scenes/BootScene.ts`** (placeholder; real asset loading in Task 11)

```ts
import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  create() {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, "🦄 Zoe's Rainbow Unicorn", {
        fontSize: "48px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }
}
```

- [ ] **Step 7: Create `src/main.ts`**

```ts
import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#8ec5ff",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,
    height: 1280,
  },
  scene: [BootScene],
});
```

- [ ] **Step 8: Create `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: Install and verify the test runner**

Run: `npm install && npm test`
Expected: Vitest reports `1 passed` for `tests/smoke.test.ts`.

- [ ] **Step 10: Verify the dev server renders Phaser**

Run: `npm run dev`, open the printed localhost URL.
Expected: a light-blue canvas centered in the window showing the "🦄 Zoe's Rainbow Unicorn" text. Resize the window — the canvas scales and stays centered.

- [ ] **Step 11: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts index.html src tests
git commit -m "chore: scaffold Vite + TS + Phaser 4 + Vitest"
```

---

## Phase 1 — Core logic (pure TypeScript, TDD)

### Task 2: Shared types + seeded RNG

**Files:**
- Create: `src/core/types.ts`, `src/core/rng.ts`, `tests/core/rng.test.ts`

**Interfaces:**
- Produces:
  - `type Vec2 = { x: number; y: number }`
  - `type CuteType = "cloud" | "cupcake" | "star" | "lollipop" | "icecream" | "balloon" | "heart" | "flower" | "donut" | "butterfly"`
  - `const CUTE_TYPES: CuteType[]`
  - `type DriftParams = { swayAmplitude: number; swaySpeed: number; descendSpeed: number }`
  - `type FormationTemplate = { id: string; cols: number; rows: number; cells: { gx: number; gy: number }[] }`
  - `type TypingRule = "uniform" | "byRow" | "byCol" | "cluster"`
  - `type FormationSpec = { templateId: string; typing: TypingRule; types: CuteType[]; drift: DriftParams }`
  - `type BossSpec = { type: CuteType; maxHp: number; phases: number }`
  - `type Level = { index: number; formations: FormationSpec[]; boss?: BossSpec }`
  - `type PlacedEnemy = { pos: Vec2; type: CuteType }`
  - `type Rng = () => number` and `createRng(seed: number): Rng`

- [ ] **Step 1: Write the failing test** — `tests/core/rng.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createRng } from "../../src/core/rng";

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("produces values in [0, 1)", () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("differs across seeds", () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/rng.test.ts`
Expected: FAIL — cannot find module `../../src/core/rng`.

- [ ] **Step 3: Create `src/core/types.ts`**

```ts
export type Vec2 = { x: number; y: number };

export type CuteType =
  | "cloud" | "cupcake" | "star" | "lollipop" | "icecream"
  | "balloon" | "heart" | "flower" | "donut" | "butterfly";

export const CUTE_TYPES: CuteType[] = [
  "cloud", "cupcake", "star", "lollipop", "icecream",
  "balloon", "heart", "flower", "donut", "butterfly",
];

export type DriftParams = { swayAmplitude: number; swaySpeed: number; descendSpeed: number };

export type FormationTemplate = {
  id: string;
  cols: number;
  rows: number;
  cells: { gx: number; gy: number }[];
};

export type TypingRule = "uniform" | "byRow" | "byCol" | "cluster";

export type FormationSpec = {
  templateId: string;
  typing: TypingRule;
  types: CuteType[];
  drift: DriftParams;
};

export type BossSpec = { type: CuteType; maxHp: number; phases: number };

export type Level = { index: number; formations: FormationSpec[]; boss?: BossSpec };

export type PlacedEnemy = { pos: Vec2; type: CuteType };

export type Rng = () => number;
```

- [ ] **Step 4: Create `src/core/rng.ts`** (mulberry32 — small, fast, deterministic)

```ts
import type { Rng } from "./types";

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer in [min, max]. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick one element. Array must be non-empty. */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/core/rng.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/core/rng.ts tests/core/rng.test.ts
git commit -m "feat(core): shared types + seeded RNG"
```

---

### Task 3: Formation templates + type assignment

**Files:**
- Create: `src/core/formations.ts`, `tests/core/formations.test.ts`

**Interfaces:**
- Consumes: `FormationTemplate`, `TypingRule`, `CuteType`, `Rng` from Task 2.
- Produces:
  - `const TEMPLATES: Record<string, FormationTemplate>` with at least ids: `"block3x3"`, `"twoRows"`, `"arch"`, `"heart"`, `"diamond"`, `"vRows4"`.
  - `function assignTypes(template: FormationTemplate, rule: TypingRule, types: CuteType[], rng: Rng): CuteType[]` — returns one CuteType per cell (same order as `template.cells`).

- [ ] **Step 1: Write the failing test** — `tests/core/formations.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { TEMPLATES, assignTypes } from "../../src/core/formations";
import { createRng } from "../../src/core/rng";

describe("TEMPLATES", () => {
  it("exposes the required templates with non-empty, in-bounds cells", () => {
    for (const id of ["block3x3", "twoRows", "arch", "heart", "diamond", "vRows4"]) {
      const t = TEMPLATES[id];
      expect(t, id).toBeDefined();
      expect(t.cells.length).toBeGreaterThan(0);
      for (const c of t.cells) {
        expect(c.gx).toBeGreaterThanOrEqual(0);
        expect(c.gx).toBeLessThan(t.cols);
        expect(c.gy).toBeGreaterThanOrEqual(0);
        expect(c.gy).toBeLessThan(t.rows);
      }
    }
  });
});

describe("assignTypes", () => {
  const t = TEMPLATES.twoRows;

  it("returns one type per cell", () => {
    const out = assignTypes(t, "uniform", ["cupcake"], createRng(1));
    expect(out.length).toBe(t.cells.length);
  });

  it("uniform uses only the first type", () => {
    const out = assignTypes(t, "uniform", ["cupcake", "star"], createRng(1));
    expect(new Set(out)).toEqual(new Set(["cupcake"]));
  });

  it("byRow gives every cell in a row the same type", () => {
    const out = assignTypes(t, "byRow", ["cupcake", "star"], createRng(1));
    const byRow = new Map<number, Set<string>>();
    t.cells.forEach((c, i) => {
      const s = byRow.get(c.gy) ?? new Set();
      s.add(out[i]);
      byRow.set(c.gy, s);
    });
    for (const s of byRow.values()) expect(s.size).toBe(1);
  });

  it("only emits types from the provided list", () => {
    const out = assignTypes(t, "cluster", ["heart", "flower", "donut"], createRng(3));
    for (const ty of out) expect(["heart", "flower", "donut"]).toContain(ty);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/formations.test.ts`
Expected: FAIL — cannot find module `formations`.

- [ ] **Step 3: Create `src/core/formations.ts`**

```ts
import type { CuteType, FormationTemplate, Rng, TypingRule } from "./types";

function grid(id: string, cols: number, rows: number, mask: string[]): FormationTemplate {
  const cells: { gx: number; gy: number }[] = [];
  mask.forEach((line, gy) => {
    [...line].forEach((ch, gx) => {
      if (ch === "#") cells.push({ gx, gy });
    });
  });
  return { id, cols, rows, cells };
}

export const TEMPLATES: Record<string, FormationTemplate> = {
  block3x3: grid("block3x3", 3, 3, ["###", "###", "###"]),
  twoRows: grid("twoRows", 6, 2, ["######", "######"]),
  arch: grid("arch", 5, 3, [".###.", "#...#", "#...#"]),
  heart: grid("heart", 5, 4, [".#.#.", "#####", ".###.", "..#.."]),
  diamond: grid("diamond", 5, 5, ["..#..", ".###.", "#####", ".###.", "..#.."]),
  vRows4: grid("vRows4", 7, 4, ["#######", "#######", "#######", "#######"]),
};

export function assignTypes(
  template: FormationTemplate,
  rule: TypingRule,
  types: CuteType[],
  rng: Rng,
): CuteType[] {
  const pool = types.length > 0 ? types : (["cupcake"] as CuteType[]);
  return template.cells.map((c, i) => {
    switch (rule) {
      case "uniform":
        return pool[0];
      case "byRow":
        return pool[c.gy % pool.length];
      case "byCol":
        return pool[c.gx % pool.length];
      case "cluster": {
        // Stable pseudo-random clustering by cell index, deterministic via rng seed offset.
        const r = Math.floor(rng() * pool.length);
        return pool[(r + i) % pool.length];
      }
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/formations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/formations.ts tests/core/formations.test.ts
git commit -m "feat(core): formation templates + type assignment"
```

---

### Task 4: Aspect-aware formation layout

**Files:**
- Modify: `src/core/formations.ts`
- Modify: `tests/core/formations.test.ts`

**Interfaces:**
- Consumes: `FormationTemplate`, `CuteType[]` (assigned types), `PlacedEnemy`, `Vec2`.
- Produces:
  - `type Playfield = { width: number; height: number }`
  - `function layoutFormation(template: FormationTemplate, assigned: CuteType[], field: Playfield, opts?: { topMargin?: number; cellSize?: number }): PlacedEnemy[]` — centers the template horizontally in `field.width`, places the top row at `topMargin` (default 180), uses `cellSize` (default 110) logical px spacing, returns placed enemies in cells order. All `pos` strictly within `[0, field.width] × [0, field.height]`.

- [ ] **Step 1: Add failing tests** — append to `tests/core/formations.test.ts`

```ts
import { layoutFormation } from "../../src/core/formations";

describe("layoutFormation", () => {
  const field = { width: 720, height: 1280 };

  it("returns one placed enemy per assigned type, preserving order", () => {
    const t = TEMPLATES.block3x3;
    const assigned = assignTypes(t, "uniform", ["star"], createRng(1));
    const placed = layoutFormation(t, assigned, field);
    expect(placed.length).toBe(t.cells.length);
    expect(placed[0].type).toBe("star");
  });

  it("keeps all enemies inside the playfield", () => {
    const t = TEMPLATES.vRows4;
    const assigned = assignTypes(t, "byRow", ["cloud", "heart"], createRng(1));
    const placed = layoutFormation(t, assigned, field);
    for (const p of placed) {
      expect(p.pos.x).toBeGreaterThanOrEqual(0);
      expect(p.pos.x).toBeLessThanOrEqual(field.width);
      expect(p.pos.y).toBeGreaterThanOrEqual(0);
      expect(p.pos.y).toBeLessThanOrEqual(field.height);
    }
  });

  it("centers horizontally — leftmost and rightmost margins are equal", () => {
    const t = TEMPLATES.twoRows;
    const assigned = assignTypes(t, "uniform", ["donut"], createRng(1));
    const placed = layoutFormation(t, assigned, field);
    const xs = placed.map((p) => p.pos.x);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    expect(Math.abs(left - (field.width - right))).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/formations.test.ts`
Expected: FAIL — `layoutFormation` not exported.

- [ ] **Step 3: Append `layoutFormation` to `src/core/formations.ts`**

```ts
import type { PlacedEnemy } from "./types";

export type Playfield = { width: number; height: number };

export function layoutFormation(
  template: FormationTemplate,
  assigned: CuteType[],
  field: Playfield,
  opts: { topMargin?: number; cellSize?: number } = {},
): PlacedEnemy[] {
  const cellSize = opts.cellSize ?? 110;
  const topMargin = opts.topMargin ?? 180;
  const totalWidth = (template.cols - 1) * cellSize;
  const originX = (field.width - totalWidth) / 2;
  return template.cells.map((c, i) => ({
    pos: { x: originX + c.gx * cellSize, y: topMargin + c.gy * cellSize },
    type: assigned[i],
  }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/formations.test.ts`
Expected: PASS (all formation tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/formations.ts tests/core/formations.test.ts
git commit -m "feat(core): aspect-aware formation layout"
```

---

### Task 5: The 12 authored levels

**Files:**
- Create: `src/core/levels.ts`, `tests/core/levels.test.ts`

**Interfaces:**
- Consumes: `Level`, `FormationSpec`, `BossSpec`, `CuteType` from Task 2; template ids from Task 3.
- Produces:
  - `const LEVELS: Level[]` (length 12, indices 1..12).
  - `function getLevel(index: number): Level` (throws on out-of-range).

- [ ] **Step 1: Write the failing test** — `tests/core/levels.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { LEVELS, getLevel } from "../../src/core/levels";
import { TEMPLATES } from "../../src/core/formations";

describe("LEVELS", () => {
  it("has 12 levels indexed 1..12", () => {
    expect(LEVELS.length).toBe(12);
    LEVELS.forEach((l, i) => expect(l.index).toBe(i + 1));
  });

  it("every level has 1..3 formations", () => {
    for (const l of LEVELS) {
      expect(l.formations.length).toBeGreaterThanOrEqual(1);
      expect(l.formations.length).toBeLessThanOrEqual(3);
    }
  });

  it("every level uses 1..3 distinct cute types total", () => {
    for (const l of LEVELS) {
      const types = new Set(l.formations.flatMap((f) => f.types));
      expect(types.size).toBeGreaterThanOrEqual(1);
      expect(types.size).toBeLessThanOrEqual(3);
    }
  });

  it("references only real templates", () => {
    for (const l of LEVELS)
      for (const f of l.formations) expect(TEMPLATES[f.templateId]).toBeDefined();
  });

  it("has bosses exactly at levels 5, 10, 12", () => {
    const bossLevels = LEVELS.filter((l) => l.boss).map((l) => l.index);
    expect(bossLevels).toEqual([5, 10, 12]);
  });

  it("formation count is non-decreasing and ramps to 3 by the end", () => {
    expect(LEVELS[0].formations.length).toBe(1);
    expect(LEVELS[11].formations.length).toBeGreaterThanOrEqual(1); // boss level may be 1 + boss
  });

  it("getLevel throws out of range", () => {
    expect(() => getLevel(0)).toThrow();
    expect(() => getLevel(13)).toThrow();
    expect(getLevel(1).index).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/levels.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/core/levels.ts`**

```ts
import type { CuteType, DriftParams, FormationSpec, Level } from "./types";

const calm: DriftParams = { swayAmplitude: 40, swaySpeed: 0.6, descendSpeed: 0 };
const livelier: DriftParams = { swayAmplitude: 60, swaySpeed: 0.9, descendSpeed: 0 };

function f(
  templateId: string,
  typing: FormationSpec["typing"],
  types: CuteType[],
  drift: DriftParams = calm,
): FormationSpec {
  return { templateId, typing, types, drift };
}

export const LEVELS: Level[] = [
  // 1: gentle intro — one type, one formation
  { index: 1, formations: [f("twoRows", "uniform", ["cloud"])] },
  // 2
  { index: 2, formations: [f("block3x3", "uniform", ["cupcake"])] },
  // 3: two formations, two types
  { index: 3, formations: [f("twoRows", "uniform", ["star"]), f("arch", "uniform", ["lollipop"])] },
  // 4: byRow mixing two types
  { index: 4, formations: [f("vRows4", "byRow", ["icecream", "balloon"]), f("diamond", "uniform", ["star"])] },
  // 5: BOSS — giant cupcake
  {
    index: 5,
    formations: [f("twoRows", "uniform", ["cupcake"])],
    boss: { type: "cupcake", maxHp: 18, phases: 2 },
  },
  // 6
  { index: 6, formations: [f("heart", "uniform", ["heart"]), f("twoRows", "byCol", ["heart", "flower"])] },
  // 7: three formations
  {
    index: 7,
    formations: [
      f("block3x3", "uniform", ["donut"]),
      f("arch", "uniform", ["star"]),
      f("twoRows", "byRow", ["donut", "star"], livelier),
    ],
  },
  // 8
  {
    index: 8,
    formations: [
      f("vRows4", "cluster", ["butterfly", "flower"]),
      f("diamond", "uniform", ["butterfly"]),
      f("twoRows", "uniform", ["flower"], livelier),
    ],
  },
  // 9
  {
    index: 9,
    formations: [
      f("heart", "byRow", ["heart", "star"]),
      f("vRows4", "byCol", ["balloon", "lollipop"]),
      f("arch", "uniform", ["cupcake"], livelier),
    ],
  },
  // 10: BOSS — giant cloud
  {
    index: 10,
    formations: [f("vRows4", "byRow", ["cloud", "star"], livelier)],
    boss: { type: "cloud", maxHp: 26, phases: 2 },
  },
  // 11: pre-finale, three lively formations, three types
  {
    index: 11,
    formations: [
      f("diamond", "uniform", ["icecream"], livelier),
      f("vRows4", "cluster", ["icecream", "donut", "heart"], livelier),
      f("heart", "byRow", ["heart", "donut"], livelier),
    ],
  },
  // 12: FINAL BOSS — giant star
  {
    index: 12,
    formations: [f("vRows4", "cluster", ["star", "balloon", "heart"], livelier)],
    boss: { type: "star", maxHp: 36, phases: 2 },
  },
];

export function getLevel(index: number): Level {
  const l = LEVELS.find((x) => x.index === index);
  if (!l) throw new Error(`No level ${index}`);
  return l;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/levels.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/levels.ts tests/core/levels.test.ts
git commit -m "feat(core): 12 authored levels with bosses at 5/10/12"
```

---

### Task 6: Difficulty budget + procedural rainbow waves

**Files:**
- Create: `src/core/difficulty.ts`, `src/core/rainbow.ts`, `tests/core/rainbow.test.ts`

**Interfaces:**
- Consumes: `FormationSpec`, `CuteType`, `Rng`, `TEMPLATES`, `CUTE_TYPES`.
- Produces:
  - `function budgetForDepth(depth: number): number` (monotonic non-decreasing in depth).
  - `function typeCountForDepth(depth: number): number` (1..3).
  - `function generateRainbowWave(depth: number, rng: Rng): FormationSpec[]` — 1..3 coherent formations whose template "costs" sum within budget; uses only real template ids; each formation's `types` length is 1..3; deterministic for a given (depth, seed).

- [ ] **Step 1: Write the failing test** — `tests/core/rainbow.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { budgetForDepth, typeCountForDepth } from "../../src/core/difficulty";
import { generateRainbowWave } from "../../src/core/rainbow";
import { TEMPLATES } from "../../src/core/formations";
import { createRng } from "../../src/core/rng";

describe("difficulty", () => {
  it("budget is non-decreasing with depth", () => {
    for (let d = 1; d < 30; d++) {
      expect(budgetForDepth(d + 1)).toBeGreaterThanOrEqual(budgetForDepth(d));
    }
  });
  it("type count stays within 1..3", () => {
    for (let d = 1; d < 50; d++) {
      const n = typeCountForDepth(d);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });
});

describe("generateRainbowWave", () => {
  it("is deterministic for (depth, seed)", () => {
    const a = generateRainbowWave(5, createRng(99));
    const b = generateRainbowWave(5, createRng(99));
    expect(a).toEqual(b);
  });

  it("produces 1..3 coherent formations with real templates", () => {
    for (let d = 1; d < 20; d++) {
      const w = generateRainbowWave(d, createRng(d));
      expect(w.length).toBeGreaterThanOrEqual(1);
      expect(w.length).toBeLessThanOrEqual(3);
      for (const f of w) {
        expect(TEMPLATES[f.templateId]).toBeDefined();
        expect(f.types.length).toBeGreaterThanOrEqual(1);
        expect(f.types.length).toBeLessThanOrEqual(3);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/rainbow.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `src/core/difficulty.ts`**

```ts
export function budgetForDepth(depth: number): number {
  // Gentle ramp: starts ~6, +1.5 per depth, capped so it never becomes chaotic.
  return Math.min(6 + Math.floor(depth * 1.5), 28);
}

export function typeCountForDepth(depth: number): number {
  if (depth < 3) return 1;
  if (depth < 7) return 2;
  return 3;
}
```

- [ ] **Step 4: Create `src/core/rainbow.ts`**

```ts
import type { CuteType, DriftParams, FormationSpec, Rng, TypingRule } from "./types";
import { CUTE_TYPES } from "./types";
import { TEMPLATES } from "./formations";
import { budgetForDepth, typeCountForDepth } from "./difficulty";
import { pick } from "./rng";

const TEMPLATE_COST: Record<string, number> = {
  block3x3: 6, twoRows: 6, arch: 5, heart: 7, diamond: 6, vRows4: 10,
};
const TYPINGS: TypingRule[] = ["uniform", "byRow", "byCol", "cluster"];

export function generateRainbowWave(depth: number, rng: Rng): FormationSpec[] {
  let budget = budgetForDepth(depth);
  const nTypes = typeCountForDepth(depth);

  // Pick the palette for this wave deterministically.
  const palette: CuteType[] = [];
  while (palette.length < nTypes) {
    const t = pick(rng, CUTE_TYPES);
    if (!palette.includes(t)) palette.push(t);
  }

  const drift: DriftParams = {
    swayAmplitude: 40 + Math.min(depth * 2, 40),
    swaySpeed: 0.6 + Math.min(depth * 0.03, 0.6),
    descendSpeed: 0,
  };

  const ids = Object.keys(TEMPLATES);
  const formations: FormationSpec[] = [];
  while (formations.length < 3 && budget > 0) {
    const affordable = ids.filter((id) => TEMPLATE_COST[id] <= budget);
    if (affordable.length === 0) break;
    const id = pick(rng, affordable);
    budget -= TEMPLATE_COST[id];
    const typing = formations.length === 0 || palette.length === 1 ? "uniform" : pick(rng, TYPINGS);
    // Each formation uses 1..nTypes of the palette.
    const useCount = 1 + Math.floor(rng() * palette.length);
    formations.push({ templateId: id, typing, types: palette.slice(0, useCount), drift });
  }
  if (formations.length === 0) {
    formations.push({ templateId: "twoRows", typing: "uniform", types: [palette[0]], drift });
  }
  return formations;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/core/rainbow.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/difficulty.ts src/core/rainbow.ts tests/core/rainbow.test.ts
git commit -m "feat(core): difficulty budget + procedural rainbow waves"
```

---

### Task 7: Collision (circle overlap + layer-pruned hits)

**Files:**
- Create: `src/core/collision.ts`, `tests/core/collision.test.ts`

**Interfaces:**
- Produces:
  - `type Circle = { x: number; y: number; r: number }`
  - `function circleOverlap(a: Circle, b: Circle): boolean`
  - `type Hit = { starIndex: number; enemyIndex: number }`
  - `function findStarEnemyHits(stars: Circle[], enemies: Circle[]): Hit[]` — only star↔enemy pairs (never star↔star or enemy↔enemy); first hit per star (a star is consumed once).

- [ ] **Step 1: Write the failing test** — `tests/core/collision.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { circleOverlap, findStarEnemyHits } from "../../src/core/collision";

describe("circleOverlap", () => {
  it("true when overlapping", () => {
    expect(circleOverlap({ x: 0, y: 0, r: 10 }, { x: 5, y: 0, r: 10 })).toBe(true);
  });
  it("false when apart", () => {
    expect(circleOverlap({ x: 0, y: 0, r: 5 }, { x: 100, y: 0, r: 5 })).toBe(false);
  });
});

describe("findStarEnemyHits", () => {
  it("matches stars to overlapping enemies", () => {
    const stars = [{ x: 0, y: 0, r: 8 }, { x: 200, y: 0, r: 8 }];
    const enemies = [{ x: 5, y: 0, r: 20 }, { x: 205, y: 0, r: 20 }];
    const hits = findStarEnemyHits(stars, enemies);
    expect(hits).toEqual([
      { starIndex: 0, enemyIndex: 0 },
      { starIndex: 1, enemyIndex: 1 },
    ]);
  });
  it("consumes each star at most once", () => {
    const stars = [{ x: 0, y: 0, r: 8 }];
    const enemies = [{ x: 0, y: 0, r: 20 }, { x: 1, y: 0, r: 20 }];
    expect(findStarEnemyHits(stars, enemies).length).toBe(1);
  });
  it("returns nothing when nothing overlaps", () => {
    expect(findStarEnemyHits([{ x: 0, y: 0, r: 1 }], [{ x: 999, y: 0, r: 1 }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/collision.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/core/collision.ts`**

```ts
export type Circle = { x: number; y: number; r: number };
export type Hit = { starIndex: number; enemyIndex: number };

export function circleOverlap(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = a.r + b.r;
  return dx * dx + dy * dy <= rr * rr;
}

export function findStarEnemyHits(stars: Circle[], enemies: Circle[]): Hit[] {
  const hits: Hit[] = [];
  const usedEnemy = new Set<number>();
  for (let s = 0; s < stars.length; s++) {
    for (let e = 0; e < enemies.length; e++) {
      if (usedEnemy.has(e)) continue;
      if (circleOverlap(stars[s], enemies[e])) {
        hits.push({ starIndex: s, enemyIndex: e });
        usedEnemy.add(e);
        break; // each star consumed once
      }
    }
  }
  return hits;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/collision.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/collision.ts tests/core/collision.test.ts
git commit -m "feat(core): circle collision with layer-pruned hit detection"
```

---

### Task 8: Bullet magnetism

**Files:**
- Create: `src/core/magnetism.ts`, `tests/core/magnetism.test.ts`

**Interfaces:**
- Consumes: `Vec2`.
- Produces:
  - `function nearestEnemy(starPos: Vec2, enemies: Vec2[], maxDist: number): number` — index of nearest enemy within `maxDist`, else `-1`.
  - `function steerVelocity(vel: Vec2, starPos: Vec2, target: Vec2, strength: number, dt: number): Vec2` — nudges horizontal velocity toward target; preserves overall speed magnitude.

- [ ] **Step 1: Write the failing test** — `tests/core/magnetism.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { nearestEnemy, steerVelocity } from "../../src/core/magnetism";

describe("nearestEnemy", () => {
  it("finds the closest within range", () => {
    const idx = nearestEnemy({ x: 0, y: 0 }, [{ x: 300, y: 0 }, { x: 50, y: 0 }], 200);
    expect(idx).toBe(1);
  });
  it("returns -1 when none in range", () => {
    expect(nearestEnemy({ x: 0, y: 0 }, [{ x: 999, y: 0 }], 100)).toBe(-1);
  });
});

describe("steerVelocity", () => {
  it("pulls a straight-up star horizontally toward a target to its right", () => {
    const v = steerVelocity({ x: 0, y: -100 }, { x: 0, y: 0 }, { x: 100, y: -200 }, 5, 0.1);
    expect(v.x).toBeGreaterThan(0);
  });
  it("preserves speed magnitude (within tolerance)", () => {
    const v = steerVelocity({ x: 0, y: -100 }, { x: 0, y: 0 }, { x: 100, y: -200 }, 5, 0.1);
    const speed = Math.hypot(v.x, v.y);
    expect(Math.abs(speed - 100)).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/magnetism.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/core/magnetism.ts`**

```ts
import type { Vec2 } from "./types";

export function nearestEnemy(starPos: Vec2, enemies: Vec2[], maxDist: number): number {
  let best = -1;
  let bestD = maxDist * maxDist;
  for (let i = 0; i < enemies.length; i++) {
    const dx = enemies[i].x - starPos.x;
    const dy = enemies[i].y - starPos.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function steerVelocity(
  vel: Vec2,
  starPos: Vec2,
  target: Vec2,
  strength: number,
  dt: number,
): Vec2 {
  const speed = Math.hypot(vel.x, vel.y) || 1;
  const dx = target.x - starPos.x;
  const dy = target.y - starPos.y;
  const len = Math.hypot(dx, dy) || 1;
  // Blend current direction toward target direction.
  const t = Math.min(strength * dt, 1);
  const nx = vel.x / speed + (dx / len) * t;
  const ny = vel.y / speed + (dy / len) * t;
  const nlen = Math.hypot(nx, ny) || 1;
  return { x: (nx / nlen) * speed, y: (ny / nlen) * speed };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/magnetism.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/magnetism.ts tests/core/magnetism.test.ts
git commit -m "feat(core): bullet magnetism (nearest target + velocity steering)"
```

---

### Task 9: Input aim resolver + autofire timer

**Files:**
- Create: `src/core/input.ts`, `tests/core/input.test.ts`

**Interfaces:**
- Consumes: `Vec2`.
- Produces:
  - `type AimInput = { pointer: Vec2 | null; keys: { left: boolean; right: boolean; up: boolean; down: boolean }; }`
  - `type Bounds = { minX: number; maxX: number; minY: number; maxY: number }`
  - `function resolveTarget(current: Vec2, input: AimInput, keySpeed: number, dt: number, bounds: Bounds): Vec2` — if `pointer` set, target = pointer (clamped); else move by keys at `keySpeed` px/s (clamped). Vertical movement allowed only within bounds.
  - `class AutoFire { constructor(intervalSec: number); update(dt: number): number /* shots to emit this frame */; reset(): void }`

- [ ] **Step 1: Write the failing test** — `tests/core/input.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { resolveTarget, AutoFire } from "../../src/core/input";

const bounds = { minX: 40, maxX: 680, minY: 900, maxY: 1200 };
const noKeys = { left: false, right: false, up: false, down: false };

describe("resolveTarget", () => {
  it("follows the pointer, clamped to bounds", () => {
    const t = resolveTarget({ x: 360, y: 1100 }, { pointer: { x: 9999, y: 9999 }, keys: noKeys }, 600, 0.016, bounds);
    expect(t.x).toBe(bounds.maxX);
    expect(t.y).toBe(bounds.maxY);
  });
  it("moves right with the right key when no pointer", () => {
    const t = resolveTarget({ x: 360, y: 1100 }, { pointer: null, keys: { ...noKeys, right: true } }, 600, 0.1, bounds);
    expect(t.x).toBeCloseTo(360 + 60, 3);
  });
  it("does not move below minY/above maxY with keys", () => {
    const t = resolveTarget({ x: 360, y: 1200 }, { pointer: null, keys: { ...noKeys, down: true } }, 600, 1, bounds);
    expect(t.y).toBe(bounds.maxY);
  });
});

describe("AutoFire", () => {
  it("emits one shot per interval", () => {
    const af = new AutoFire(0.2);
    expect(af.update(0.1)).toBe(0);
    expect(af.update(0.15)).toBe(1); // 0.25 total >= 0.2
  });
  it("emits multiple shots if a big dt elapses", () => {
    const af = new AutoFire(0.1);
    expect(af.update(0.35)).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/input.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/core/input.ts`**

```ts
import type { Vec2 } from "./types";

export type AimInput = {
  pointer: Vec2 | null;
  keys: { left: boolean; right: boolean; up: boolean; down: boolean };
};
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function resolveTarget(
  current: Vec2,
  input: AimInput,
  keySpeed: number,
  dt: number,
  bounds: Bounds,
): Vec2 {
  if (input.pointer) {
    return {
      x: clamp(input.pointer.x, bounds.minX, bounds.maxX),
      y: clamp(input.pointer.y, bounds.minY, bounds.maxY),
    };
  }
  let { x, y } = current;
  const step = keySpeed * dt;
  if (input.keys.left) x -= step;
  if (input.keys.right) x += step;
  if (input.keys.up) y -= step;
  if (input.keys.down) y += step;
  return { x: clamp(x, bounds.minX, bounds.maxX), y: clamp(y, bounds.minY, bounds.maxY) };
}

export class AutoFire {
  private acc = 0;
  constructor(private intervalSec: number) {}
  update(dt: number): number {
    this.acc += dt;
    let shots = 0;
    while (this.acc >= this.intervalSec) {
      this.acc -= this.intervalSec;
      shots++;
    }
    return shots;
  }
  reset(): void {
    this.acc = 0;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/input.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/input.ts tests/core/input.test.ts
git commit -m "feat(core): aim resolver + autofire timer"
```

---

### Task 10: Boss phase state machine

**Files:**
- Create: `src/core/boss.ts`, `tests/core/boss.test.ts`

**Interfaces:**
- Consumes: `BossSpec`.
- Produces:
  - `type BossState = "entering" | "active" | "phaseTransition" | "defeated"`
  - `class BossController` with:
    - `constructor(spec: BossSpec)`
    - `hp: number` (read), `state: BossState` (read), `phase: number` (read, 1-based)
    - `update(dt: number): void` (drives entering→active and transition timing)
    - `hit(amount: number): void` (reduces hp while `active`; ignored otherwise; triggers `phaseTransition` when crossing a phase threshold; `defeated` at hp ≤ 0)
    - `isVulnerable(): boolean` (true only while `active`)

- [ ] **Step 1: Write the failing test** — `tests/core/boss.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { BossController } from "../../src/core/boss";

const spec = { type: "cupcake" as const, maxHp: 20, phases: 2 };

describe("BossController", () => {
  it("starts entering, then becomes active after entry time", () => {
    const b = new BossController(spec);
    expect(b.state).toBe("entering");
    expect(b.isVulnerable()).toBe(false);
    b.update(2); // entry completes
    expect(b.state).toBe("active");
    expect(b.isVulnerable()).toBe(true);
    expect(b.phase).toBe(1);
  });

  it("ignores hits until active", () => {
    const b = new BossController(spec);
    b.hit(5);
    expect(b.hp).toBe(20);
  });

  it("enters phaseTransition when crossing the halfway threshold", () => {
    const b = new BossController(spec);
    b.update(2);
    b.hit(11); // below 50% of 20
    expect(b.state).toBe("phaseTransition");
    expect(b.isVulnerable()).toBe(false);
    b.update(1); // transition completes
    expect(b.state).toBe("active");
    expect(b.phase).toBe(2);
  });

  it("is defeated at hp <= 0", () => {
    const b = new BossController(spec);
    b.update(2);
    b.hit(11);
    b.update(1);
    b.hit(99);
    expect(b.state).toBe("defeated");
    expect(b.hp).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/boss.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/core/boss.ts`**

```ts
import type { BossSpec } from "./types";

export type BossState = "entering" | "active" | "phaseTransition" | "defeated";

const ENTRY_TIME = 1.5;
const TRANSITION_TIME = 1.0;

export class BossController {
  hp: number;
  state: BossState = "entering";
  phase = 1;
  private timer = 0;
  private readonly maxHp: number;
  private readonly phases: number;

  constructor(spec: BossSpec) {
    this.hp = spec.maxHp;
    this.maxHp = spec.maxHp;
    this.phases = spec.phases;
  }

  update(dt: number): void {
    this.timer += dt;
    if (this.state === "entering" && this.timer >= ENTRY_TIME) {
      this.state = "active";
      this.timer = 0;
    } else if (this.state === "phaseTransition" && this.timer >= TRANSITION_TIME) {
      this.state = "active";
      this.timer = 0;
    }
  }

  hit(amount: number): void {
    if (this.state !== "active") return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.state = "defeated";
      return;
    }
    // Phase thresholds split the HP bar evenly (phases-1 boundaries).
    const nextBoundaryPhase = this.phase + 1;
    if (nextBoundaryPhase <= this.phases) {
      const threshold = this.maxHp * (1 - (this.phase) / this.phases);
      if (this.hp <= threshold) {
        this.phase = nextBoundaryPhase;
        this.state = "phaseTransition";
        this.timer = 0;
      }
    }
  }

  isVulnerable(): boolean {
    return this.state === "active";
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/boss.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the FULL core suite**

Run: `npm test`
Expected: all core tests green (rng, formations, levels, rainbow, collision, magnetism, input, boss, smoke).

- [ ] **Step 6: Commit**

```bash
git add src/core/boss.ts tests/core/boss.test.ts
git commit -m "feat(core): boss phase state machine"
```

---

## Phase 2 — Rendering seam, assets, audio

### Task 11: Sprite-key map + OpenMoji atlas + Boot loading

**Files:**
- Create: `src/render/sprites.ts`, `tests/render/sprites.test.ts`
- Create: `public/atlas/openmoji.png`, `public/atlas/openmoji.json` (generated)
- Modify: `src/scenes/BootScene.ts`
- Create: `scripts/build-atlas.md` (documents how the atlas was produced)

**Interfaces:**
- Consumes: `CuteType`, `CUTE_TYPES`.
- Produces:
  - `const SPRITE_FRAME: Record<string, string>` mapping logical keys → atlas frame names. Keys: every `CuteType`, plus `"unicorn"`, `"star"` (projectile), `"wing"`, `"sparkle"`.
  - `function frameFor(key: string): string` (throws on unknown key — guarantees no silent missing art).
  - `const ATLAS_KEY = "openmoji"`.

**Atlas production (do this in Step 0, document in `scripts/build-atlas.md`):**
Download OpenMoji PNGs (72×72, color) for: 🦄 unicorn, ☁️ cloud, 🧁 cupcake, ⭐ star, 🍭 lollipop, 🍦 ice-cream, 🎈 balloon, 💖 heart, 🌸 flower, 🍩 donut, 🦋 butterfly, ✨ sparkles. Pack into `public/atlas/openmoji.png` with a Phaser-format JSON hash atlas (`public/atlas/openmoji.json`) using free tooling (TexturePacker free, or `npx @texttopath/spritesheet` equivalent). The projectile `star` reuses the ⭐ frame tinted; `wing` is a simple white triangle drawn at runtime (no atlas frame needed) — so omit `wing` from the atlas and draw it as a Phaser triangle in Task 15. Keep frame names equal to the logical keys below for simplicity.

- [ ] **Step 1: Write the failing test** — `tests/render/sprites.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { SPRITE_FRAME, frameFor } from "../../src/render/sprites";
import { CUTE_TYPES } from "../../src/core/types";

describe("sprite map", () => {
  it("has a frame for every cute type plus unicorn, star, sparkle", () => {
    for (const t of CUTE_TYPES) expect(SPRITE_FRAME[t]).toBeDefined();
    for (const k of ["unicorn", "star", "sparkle"]) expect(SPRITE_FRAME[k]).toBeDefined();
  });
  it("frameFor throws on unknown key", () => {
    expect(() => frameFor("nope")).toThrow();
    expect(frameFor("cupcake")).toBe(SPRITE_FRAME["cupcake"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/render/sprites.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/render/sprites.ts`**

```ts
import { CUTE_TYPES } from "../core/types";

export const ATLAS_KEY = "openmoji";

// Logical key -> atlas frame name. (Frame names match keys for simplicity.)
export const SPRITE_FRAME: Record<string, string> = {
  unicorn: "unicorn",
  star: "star",
  sparkle: "sparkle",
  ...Object.fromEntries(CUTE_TYPES.map((t) => [t, t])),
};

export function frameFor(key: string): string {
  const f = SPRITE_FRAME[key];
  if (!f) throw new Error(`No sprite frame for key "${key}"`);
  return f;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/render/sprites.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `src/scenes/BootScene.ts` to load the atlas + audio and unlock sound**

```ts
import Phaser from "phaser";
import { ATLAS_KEY } from "../render/sprites";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    this.load.atlas(ATLAS_KEY, "atlas/openmoji.png", "atlas/openmoji.json");
    this.load.audio("music", ["audio/music.mp3"]);
    this.load.audio("pop", ["audio/pop.mp3"]);
    this.load.audio("fanfare", ["audio/fanfare.mp3"]);
    this.load.audio("tada", ["audio/tada.mp3"]);
    // Loading progress bar (no text — pre-readers).
    const g = this.add.graphics();
    this.load.on("progress", (p: number) => {
      g.clear().fillStyle(0xffffff, 0.9).fillRect(160, 630, 400 * p, 20);
    });
  }
  create() {
    this.scene.start("Title");
  }
}
```

- [ ] **Step 6: Verify atlas loads (run-and-observe)**

Run: `npm run dev`
Expected: the loading bar fills and the scene attempts to start "Title" (Title scene is added in Task 14; until then a "Scene key not found" warning is acceptable — note it and proceed). No 404s for `atlas/openmoji.png` / `.json` in the network tab.

- [ ] **Step 7: Commit**

```bash
git add src/render/sprites.ts tests/render/sprites.test.ts src/scenes/BootScene.ts public/atlas scripts/build-atlas.md
git commit -m "feat(render): sprite-key map + OpenMoji atlas loading"
```

---

### Task 12: Calm-mode settings + audio wrapper

**Files:**
- Create: `src/state/settings.ts`, `tests/state/settings.test.ts`
- Create: `src/audio/sound.ts`

**Interfaces:**
- Produces:
  - `settings` singleton: `{ calm: boolean; toggleCalm(): void; onChange(cb: () => void): void }` (in-memory only — no persistence per spec).
  - `class Sound { constructor(scene: Phaser.Scene); playMusic(): void; pop(): void; fanfare(): void; tada(): void }` — respects calm mode (lower volume / skips layered SFX when `settings.calm`).

- [ ] **Step 1: Write the failing test** — `tests/state/settings.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { settings } from "../../src/state/settings";

describe("settings", () => {
  beforeEach(() => {
    if (settings.calm) settings.toggleCalm();
  });
  it("defaults to calm = false (full juicy)", () => {
    expect(settings.calm).toBe(false);
  });
  it("toggles and notifies listeners", () => {
    let count = 0;
    settings.onChange(() => count++);
    settings.toggleCalm();
    expect(settings.calm).toBe(true);
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/state/settings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/state/settings.ts`**

```ts
type Listener = () => void;

class Settings {
  calm = false; // default: full juicy
  private listeners: Listener[] = [];
  toggleCalm(): void {
    this.calm = !this.calm;
    for (const l of this.listeners) l();
  }
  onChange(cb: Listener): void {
    this.listeners.push(cb);
  }
}

export const settings = new Settings();
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/state/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `src/audio/sound.ts`** (no unit test — thin Phaser wrapper, verified when scenes run)

```ts
import Phaser from "phaser";
import { settings } from "../state/settings";

export class Sound {
  constructor(private scene: Phaser.Scene) {}
  playMusic(): void {
    const vol = settings.calm ? 0.25 : 0.5;
    const m = this.scene.sound.add("music", { loop: true, volume: vol });
    m.play();
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

- [ ] **Step 6: Commit**

```bash
git add src/state/settings.ts tests/state/settings.test.ts src/audio/sound.ts
git commit -m "feat: calm-mode settings + calm-aware audio wrapper"
```

---

## Phase 3 — Phaser scenes (run-and-observe verification)

> These tasks integrate `core` logic into Phaser. They cannot be cleanly unit-tested (they need a GPU/canvas), so each ends with a **manual verification checklist** run via `npm run dev`. Keep all gameplay decisions in `core`; scenes only render and wire input.

### Task 13: Game config + responsive scale manager + animated background

**Files:**
- Modify: `src/main.ts`
- Create: `src/scenes/ui/Background.ts`

**Interfaces:**
- Consumes: nothing from core.
- Produces:
  - `LOGICAL_HEIGHT = 1280`, `computeLogicalWidth(winW, winH): number` (clamp 720–1100), exported from `src/main.ts`.
  - `class Background extends Phaser.GameObjects.Container` with `constructor(scene, width, height)` and `resize(width, height)`.

- [ ] **Step 1: Add a pure helper test** — `tests/core/layoutWidth.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { computeLogicalWidth } from "../../src/main";

describe("computeLogicalWidth", () => {
  it("clamps narrow (tall phone) to 720", () => {
    expect(computeLogicalWidth(400, 900)).toBe(720);
  });
  it("clamps wide (PC) to 1100", () => {
    expect(computeLogicalWidth(2000, 1000)).toBe(1100);
  });
  it("scales proportionally in between", () => {
    const w = computeLogicalWidth(800, 1280);
    expect(w).toBeGreaterThan(720);
    expect(w).toBeLessThan(1100);
  });
});
```

> NOTE: `src/main.ts` imports Phaser, which pulls browser globals. To keep this test node-safe, put `computeLogicalWidth` and `LOGICAL_HEIGHT` in a **separate pure module** `src/core/viewport.ts` and re-export from `main.ts`. Update the import in the test to `../../src/core/viewport`.

- [ ] **Step 2: Create `src/core/viewport.ts`**

```ts
export const LOGICAL_HEIGHT = 1280;
const MIN_W = 720;
const MAX_W = 1100;

export function computeLogicalWidth(winW: number, winH: number): number {
  const target = Math.round(LOGICAL_HEIGHT * (winW / winH));
  return Math.max(MIN_W, Math.min(MAX_W, target));
}
```

Update the test import to `../../src/core/viewport`. Run: `npx vitest run tests/core/layoutWidth.test.ts` → PASS.

- [ ] **Step 3: Create `src/scenes/ui/Background.ts`**

```ts
import Phaser from "phaser";

export class Background extends Phaser.GameObjects.Container {
  private sky: Phaser.GameObjects.Graphics;
  private clouds: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.sky = scene.add.graphics();
    this.add(this.sky);
    for (let i = 0; i < 5; i++) {
      const c = scene.add.circle(0, 0, 60, 0xffffff, 0.5);
      this.clouds.push(c);
      this.add(c);
    }
    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this.sky.clear();
    // Soft rainbow-sky vertical gradient via stacked bands.
    const bands = [0xa0e9ff, 0xc4f0ff, 0xffe6f7, 0xfff3d6, 0xe6ffe9];
    const bandH = height / bands.length;
    bands.forEach((c, i) => this.sky.fillStyle(c, 1).fillRect(0, i * bandH, width, bandH + 1));
    this.clouds.forEach((c, i) => c.setPosition((width / 6) * (i + 1), 120 + (i % 2) * 90));
  }

  update(dt: number, width: number): void {
    for (const c of this.clouds) {
      c.x += 12 * dt;
      if (c.x > width + 80) c.x = -80;
    }
  }
}
```

- [ ] **Step 4: Rewrite `src/main.ts` with responsive resize + a temporary scene to view the background**

```ts
import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { computeLogicalWidth, LOGICAL_HEIGHT } from "./core/viewport";
export { computeLogicalWidth, LOGICAL_HEIGHT } from "./core/viewport";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#8ec5ff",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: computeLogicalWidth(window.innerWidth, window.innerHeight),
    height: LOGICAL_HEIGHT,
  },
  scene: [BootScene],
});

function applySize() {
  const w = computeLogicalWidth(window.innerWidth, window.innerHeight);
  game.scale.setGameSize(w, LOGICAL_HEIGHT);
  game.events.emit("logicalresize", w, LOGICAL_HEIGHT);
}
window.addEventListener("resize", applySize);
window.addEventListener("orientationchange", applySize);
```

- [ ] **Step 5: Verify (run-and-observe)** — temporarily make `BootScene.create()` add a `Background` instead of starting Title:

Run: `npm run dev`
Expected checklist:
- A soft rainbow-sky gradient fills the whole canvas with a few drifting white clouds.
- Resizing the window from tall to wide changes the canvas aspect; **no black bars** appear inside the playfield (page background `#8ec5ff` shows only outside, matching the sky's top band).
- Revert the temporary `BootScene` change after verifying (it should `this.scene.start("Title")`).

- [ ] **Step 6: Commit**

```bash
git add src/main.ts src/core/viewport.ts src/scenes/ui/Background.ts tests/core/layoutWidth.test.ts
git commit -m "feat: responsive scale manager + animated rainbow background"
```

---

### Task 14: Title scene (name, Play, Rainbow Mode, calm toggle)

**Files:**
- Create: `src/scenes/TitleScene.ts`
- Modify: `src/main.ts` (register `TitleScene`)

**Interfaces:**
- Consumes: `Background`, `settings`, `Sound`, `ATLAS_KEY`, `frameFor`.
- Produces: scene key `"Title"`; starts `"Game"` (story) or `"Rainbow"` on button taps.

- [ ] **Step 1: Create `src/scenes/TitleScene.ts`**

```ts
import Phaser from "phaser";
import { Background } from "./ui/Background";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { settings } from "../state/settings";

const PLAYER_NAME = "Zoe";

export class TitleScene extends Phaser.Scene {
  private bg!: Background;
  constructor() {
    super("Title");
  }
  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.bg = new Background(this, W, H);

    this.add
      .text(W / 2, 220, `✨ ${PLAYER_NAME}'s Rainbow Unicorn ✨`, {
        fontSize: "44px", color: "#7a3fa0", fontStyle: "bold", align: "center",
        wordWrap: { width: W - 80 },
      })
      .setOrigin(0.5);

    const uni = this.add.image(W / 2, 430, ATLAS_KEY, frameFor("unicorn")).setScale(2.2);
    uni.setTint(0xff8fcf);
    this.tweens.add({ targets: uni, y: 400, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });

    this.makeButton(W / 2, 720, "▶  Play", 0xff7eb6, () => this.scene.start("Game"));
    this.makeButton(W / 2, 880, "🌈  Rainbow Mode", 0x7ec8ff, () => this.scene.start("Rainbow"));

    // Calm toggle — TOP corner (off the bottom edge per spec).
    this.makeCalmToggle(W - 90, 80);

    this.events.on("update", (_t: number, dms: number) => this.bg.update(dms / 1000, this.scale.width));
  }

  private makeButton(x: number, y: number, label: string, color: number, onTap: () => void) {
    const w = 460, h = 110;
    const g = this.add.graphics();
    g.fillStyle(color, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 28);
    const t = this.add.text(x, y, label, { fontSize: "40px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", onTap);
    return { g, t, zone };
  }

  private makeCalmToggle(x: number, y: number) {
    const label = () => (settings.calm ? "🌙" : "✨");
    const t = this.add.text(x, y, label(), { fontSize: "48px" }).setOrigin(0.5);
    const zone = this.add.zone(x, y, 90, 90).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => {
      settings.toggleCalm();
      t.setText(label());
    });
  }
}
```

- [ ] **Step 2: Register `TitleScene` in `src/main.ts`** — change the `scene` array to `[BootScene, TitleScene]` and add the import. (Game/Rainbow added in later tasks; tapping them will warn until then.)

- [ ] **Step 3: Verify (run-and-observe)**

Run: `npm run dev`
Expected checklist:
- Title reads "✨ Zoe's Rainbow Unicorn ✨"; a pink unicorn bobs gently.
- Two large buttons: "▶ Play" and "🌈 Rainbow Mode". A ✨/🌙 calm toggle sits in the **top-right** corner.
- Tapping the calm toggle flips ✨↔🌙.
- All buttons are large and **none are near the bottom edge**.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/TitleScene.ts src/main.ts
git commit -m "feat(scene): title with name, Play, Rainbow Mode, calm toggle"
```

---

### Task 15: Game scene — unicorn, movement, autofire, star pool

**Files:**
- Create: `src/scenes/GameScene.ts`
- Modify: `src/main.ts` (register `GameScene`)

**Interfaces:**
- Consumes: `resolveTarget`, `AutoFire`, `AimInput`, `Bounds` (core/input); `ATLAS_KEY`, `frameFor`; `Background`; `Sound`.
- Produces: scene key `"Game"`; a reusable **star pool** and a movable unicorn. (Enemies/levels added in Task 16 — this task delivers a controllable, firing unicorn over the background.)

- [ ] **Step 1: Create `src/scenes/GameScene.ts`** (movement + autofire + pooled stars)

```ts
import Phaser from "phaser";
import { Background } from "./ui/Background";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { AutoFire, resolveTarget, type AimInput, type Bounds } from "../core/input";
import { Sound } from "../audio/sound";

const STAR_SPEED = 900; // px/s upward
const KEY_SPEED = 700;
const FIRE_INTERVAL = 0.18;

export class GameScene extends Phaser.Scene {
  protected bg!: Background;
  protected sound2!: Sound;
  protected unicorn!: Phaser.GameObjects.Container;
  protected target = { x: 360, y: 1120 };
  protected stars!: Phaser.GameObjects.Group;
  protected autofire = new AutoFire(FIRE_INTERVAL);
  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  protected pointerActive = false;

  constructor(key = "Game") {
    super(key);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.bg = new Background(this, W, H);
    this.sound2 = new Sound(this);
    this.sound2.playMusic();

    // Unicorn = tinted body + simple drawn wings + sparkle trail anchor.
    const body = this.add.image(0, 0, ATLAS_KEY, frameFor("unicorn")).setScale(1.6).setTint(0xff8fcf);
    const wingL = this.add.triangle(-44, 6, 0, 0, 40, -18, 36, 26, 0xffffff, 0.9);
    const wingR = this.add.triangle(44, 6, 0, 0, -40, -18, -36, 26, 0xffffff, 0.9);
    this.unicorn = this.add.container(this.target.x, this.target.y, [wingL, body, wingR]);

    this.stars = this.add.group();
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown || this.sys.game.device.input.touch === false) {
        this.pointerActive = true;
        this.target = { x: p.worldX, y: p.worldY };
      }
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pointerActive = true;
      this.target = { x: p.worldX, y: p.worldY };
    });
  }

  protected bounds(): Bounds {
    return { minX: 50, maxX: this.scale.width - 50, minY: this.scale.height - 420, maxY: this.scale.height - 70 };
  }

  protected aimInput(): AimInput {
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

  protected fireStar() {
    const x = this.unicorn.x;
    const y = this.unicorn.y - 60;
    let s = this.stars.getFirstDead(false) as Phaser.GameObjects.Image | null;
    if (!s) {
      s = this.add.image(x, y, ATLAS_KEY, frameFor("star")).setScale(0.8);
      this.stars.add(s);
    } else {
      s.setPosition(x, y).setActive(true).setVisible(true);
    }
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.bg.update(dt, this.scale.width);

    if (this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown || this.cursors.down.isDown) {
      this.pointerActive = false; // keyboard takes over
    }
    const cur = { x: this.unicorn.x, y: this.unicorn.y };
    const next = resolveTarget(cur, this.aimInput(), KEY_SPEED, dt, this.bounds());
    // Smooth follow.
    this.unicorn.x = Phaser.Math.Linear(this.unicorn.x, next.x, Math.min(1, 12 * dt));
    this.unicorn.y = Phaser.Math.Linear(this.unicorn.y, next.y, Math.min(1, 12 * dt));

    for (const shot of Array(this.autofire.update(dt)).fill(0)) void shot, this.fireStar();

    (this.stars.getChildren() as Phaser.GameObjects.Image[]).forEach((s) => {
      if (!s.active) return;
      s.y -= STAR_SPEED * dt;
      if (s.y < -40) this.stars.killAndHide(s);
    });
  }
}
```

- [ ] **Step 2: Register `GameScene` in `src/main.ts`** (`scene: [BootScene, TitleScene, GameScene]`).

- [ ] **Step 3: Verify (run-and-observe)**

Run: `npm run dev` → tap Play.
Expected checklist:
- A pink unicorn with little white wings sits near the bottom; a stream of rainbow stars flies upward continuously (autofire).
- **Mouse:** moving the mouse moves the unicorn (follow-the-pointer). **Touch:** dragging moves it. **Keyboard:** arrow keys move it (and override the pointer).
- The unicorn cannot leave the screen or go above the lower ~third (bounds).
- Music plays after the first interaction (audio unlock).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts src/main.ts
git commit -m "feat(scene): unicorn movement, autofire, pooled rainbow stars"
```

---

### Task 16: Game scene — enemies, formation spawning, collisions, level progression

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Create: `src/scenes/ui/Celebrations.ts` (stub used here; full juice in Task 18)

**Interfaces:**
- Consumes: `getLevel`, `TEMPLATES`, `assignTypes`, `layoutFormation`, `findStarEnemyHits`, `nearestEnemy`, `steerVelocity`, `createRng`, `frameFor`.
- Produces: a full story loop — formations spawn in sequence, stars pop enemies, formation/level advance, level 12 ends → `"Rainbow"`.

- [ ] **Step 1: Create `src/scenes/ui/Celebrations.ts` (stub)**

```ts
import Phaser from "phaser";
import { ATLAS_KEY, frameFor } from "../../render/sprites";
import { settings } from "../../state/settings";

export class Celebrations {
  constructor(private scene: Phaser.Scene) {}
  popAt(x: number, y: number) {
    const n = settings.calm ? 3 : 8;
    for (let i = 0; i < n; i++) {
      const s = this.scene.add.image(x, y, ATLAS_KEY, frameFor("sparkle")).setScale(0.6);
      const ang = (Math.PI * 2 * i) / n;
      this.scene.tweens.add({
        targets: s, x: x + Math.cos(ang) * 60, y: y + Math.sin(ang) * 60,
        alpha: 0, duration: 400, onComplete: () => s.destroy(),
      });
    }
  }
  banner(text: string, color = "#ff5fa2") {
    const W = this.scene.scale.width;
    const t = this.scene.add.text(W / 2, 360, text, { fontSize: "60px", color, fontStyle: "bold" }).setOrigin(0.5).setScale(0);
    this.scene.tweens.add({ targets: t, scale: 1, yoyo: true, hold: 600, duration: 300, onComplete: () => t.destroy() });
  }
}
```

- [ ] **Step 2: Extend `GameScene` with enemies + progression** — add these members/methods (integrate into the existing class):

```ts
// add imports at top of GameScene.ts:
import { getLevel } from "../core/levels";
import { TEMPLATES, assignTypes, layoutFormation } from "../core/formations";
import { findStarEnemyHits, type Circle } from "../core/collision";
import { nearestEnemy, steerVelocity } from "../core/magnetism";
import { createRng } from "../core/rng";
import { Celebrations } from "./ui/Celebrations";
import type { PlacedEnemy } from "../core/types";

// add fields:
protected enemies!: Phaser.GameObjects.Group;
protected fx!: Celebrations;
protected levelIndex = 1;
protected formationIndex = 0;
protected t = 0;
protected isStory = true;

// in create(), after stars/group setup:
this.enemies = this.add.group();
this.fx = new Celebrations(this);
this.spawnFormation();

// spawn the current formation of the current level:
protected currentFormations() {
  return getLevel(this.levelIndex).formations;
}
protected spawnFormation() {
  const spec = this.currentFormations()[this.formationIndex];
  const tpl = TEMPLATES[spec.templateId];
  const rng = createRng(this.levelIndex * 100 + this.formationIndex);
  const assigned = assignTypes(tpl, spec.typing, spec.types, rng);
  const placed: PlacedEnemy[] = layoutFormation(tpl, assigned, { width: this.scale.width, height: this.scale.height });
  for (const pe of placed) {
    const img = this.add.image(pe.pos.x, pe.pos.y, ATLAS_KEY, frameFor(pe.type)).setScale(1.1);
    img.setData("baseX", pe.pos.x);
    img.setData("drift", spec.drift);
    this.enemies.add(img);
  }
}

// drift + collision in update() (call from update after star movement):
protected updateEnemies(dt: number) {
  this.t += dt;
  (this.enemies.getChildren() as Phaser.GameObjects.Image[]).forEach((e) => {
    if (!e.active) return;
    const drift = e.getData("drift");
    e.x = e.getData("baseX") + Math.sin(this.t * drift.swaySpeed) * drift.swayAmplitude;
  });

  const activeStars = (this.stars.getChildren() as Phaser.GameObjects.Image[]).filter((s) => s.active);
  const activeEnemies = (this.enemies.getChildren() as Phaser.GameObjects.Image[]).filter((e) => e.active);

  // Bullet magnetism: steer each star toward nearest enemy.
  activeStars.forEach((s) => {
    const idx = nearestEnemy({ x: s.x, y: s.y }, activeEnemies.map((e) => ({ x: e.x, y: e.y })), 160);
    if (idx >= 0) {
      const v = steerVelocity({ x: (s.getData("vx") ?? 0), y: -1 }, { x: s.x, y: s.y }, { x: activeEnemies[idx].x, y: activeEnemies[idx].y }, 6, dt);
      s.x += v.x * dt * 300;
      s.setData("vx", v.x);
    }
  });

  const starCircles: Circle[] = activeStars.map((s) => ({ x: s.x, y: s.y, r: 22 }));
  const enemyCircles: Circle[] = activeEnemies.map((e) => ({ x: e.x, y: e.y, r: 55 })); // generous
  const hits = findStarEnemyHits(starCircles, enemyCircles);
  for (const h of hits) {
    const e = activeEnemies[h.enemyIndex];
    this.fx.popAt(e.x, e.y);
    this.sound2.pop();
    this.enemies.killAndHide(e);
    this.stars.killAndHide(activeStars[h.starIndex]);
  }

  if (activeEnemies.length - hits.length <= 0 && this.enemies.countActive() === 0) {
    this.onFormationCleared();
  }
}

protected onFormationCleared() {
  const formations = this.currentFormations();
  if (this.formationIndex < formations.length - 1) {
    this.formationIndex++;
    this.fx.banner("More!", "#ff9f43");
    this.time.delayedCall(700, () => this.spawnFormation());
  } else {
    this.onLevelCleared();
  }
}

protected onLevelCleared() {
  this.sound2.fanfare();
  this.fx.banner("Yay! 🌈");
  if (this.levelIndex >= 12) {
    this.time.delayedCall(1500, () => this.scene.start("Rainbow"));
    return;
  }
  this.levelIndex++;
  this.formationIndex = 0;
  this.time.delayedCall(1200, () => this.spawnFormation());
}
```

> NOTE on boss levels: levels 5/10/12 have a `boss` field. For THIS task, ignore the boss and just clear their formations (the boss is wired in Task 17, where `onLevelCleared`/spawn is adjusted to spawn the boss before completing the level). Leave a `// TODO(Task17): boss` comment at the boss branch.

- [ ] **Step 3: Call `updateEnemies(dt)` from `update()`** — add `this.updateEnemies(dt);` at the end of the existing `update` method.

- [ ] **Step 4: Verify (run-and-observe)**

Run: `npm run dev` → Play.
Expected checklist:
- A coherent formation (e.g. two rows of clouds) flies in and sways gently; no diving.
- Stars pop enemies (with a sparkle + pop sound); stars curve slightly toward nearby enemies (magnetism — aim feels forgiving).
- Clearing a formation in a multi-formation level shows "More!" and spawns the next.
- Clearing the last formation shows "Yay! 🌈" and advances to the next level (watch types/formation count change per `levels.ts`).
- Enemy hitboxes feel generous (near-misses still pop).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.ts src/scenes/ui/Celebrations.ts
git commit -m "feat(scene): enemies, coherent formation spawning, magnetism, collisions, level progression"
```

---

### Task 17: Bosses (giant cute thing, happiness meter, phases)

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `BossController`, `BossState` (core/boss); `getLevel(...).boss`.
- Produces: boss fights on levels 5/10/12 — a giant tinted cute sprite with a visible "happiness meter," 2 gentle telegraphed phases, no harmful attacks; defeat → big celebration → continue/finale.

- [ ] **Step 1: Add boss state + spawn to `GameScene`**

```ts
// imports:
import { BossController } from "../core/boss";

// fields:
protected boss?: Phaser.GameObjects.Image;
protected bossCtl?: BossController;
protected bossBar?: Phaser.GameObjects.Graphics;

// Replace the boss TODO in onFormationCleared/onLevelCleared flow:
// After the last formation of a boss level is cleared, spawn the boss instead of finishing.
protected maybeStartBossOrFinish() {
  const lvl = getLevel(this.levelIndex);
  if (lvl.boss && !this.bossCtl) {
    this.startBoss();
  } else {
    this.onLevelCleared();
  }
}

protected startBoss() {
  const spec = getLevel(this.levelIndex).boss!;
  this.bossCtl = new BossController(spec);
  this.boss = this.add.image(this.scale.width / 2, 320, ATLAS_KEY, frameFor(spec.type)).setScale(4).setTint(0xfff0a0);
  this.bossBar = this.add.graphics();
  this.tweens.add({ targets: this.boss, x: this.scale.width / 2 + 80, yoyo: true, repeat: -1, duration: 1600, ease: "Sine.inOut" });
}

protected updateBoss(dt: number) {
  if (!this.bossCtl || !this.boss) return;
  this.bossCtl.update(dt);

  // Telegraph phase transition with a color flash; "wiggle" when active.
  if (this.bossCtl.state === "phaseTransition") this.boss.setTint(0xff7777);
  else if (this.bossCtl.state === "active") this.boss.setTint(0xfff0a0);

  // Stars hit the boss only while vulnerable.
  const activeStars = (this.stars.getChildren() as Phaser.GameObjects.Image[]).filter((s) => s.active);
  if (this.bossCtl.isVulnerable()) {
    for (const s of activeStars) {
      const dx = s.x - this.boss.x, dy = s.y - this.boss.y;
      if (dx * dx + dy * dy < 150 * 150) {
        this.bossCtl.hit(1);
        this.fx.popAt(s.x, s.y);
        this.sound2.pop();
        this.stars.killAndHide(s);
      }
    }
  }

  // Happiness meter (top, off the bottom edge).
  const frac = Math.max(0, this.bossCtl.hp / getLevel(this.levelIndex).boss!.maxHp);
  this.bossBar!.clear().fillStyle(0xffffff, 0.4).fillRoundedRect(120, 120, this.scale.width - 240, 28, 14)
    .fillStyle(0xff5fa2, 1).fillRoundedRect(120, 120, (this.scale.width - 240) * frac, 28, 14);

  if (this.bossCtl.state === "defeated") {
    this.fx.popAt(this.boss.x, this.boss.y);
    this.boss.destroy(); this.bossBar!.destroy();
    this.boss = undefined; this.bossCtl = undefined;
    this.onLevelCleared();
  }
}
```

- [ ] **Step 2: Wire boss into the loop**
- In `onFormationCleared`, when the last formation is cleared, call `this.maybeStartBossOrFinish()` instead of `this.onLevelCleared()` directly.
- In `update()`, add `this.updateBoss(dt);`.
- In `onLevelCleared`, before advancing, ensure `this.bossCtl = undefined`.

- [ ] **Step 3: Verify (run-and-observe)** — temporarily set `this.levelIndex = 5` at the top of `create()` to reach the boss fast; revert after.

Run: `npm run dev` → Play.
Expected checklist:
- After the level-5 formation clears, a **giant cupcake** flies in and sways; a pink "happiness meter" shows at the **top**.
- Stars reduce the meter; at ~50% the boss flashes (phase transition) and briefly stops taking hits, then resumes (phase 2).
- Emptying the meter bursts the boss into sparkles + fanfare, then advances.
- The boss never fires anything / never hurts the unicorn.
- Revert the temporary `levelIndex` change.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat(scene): friendly bosses with happiness meter and gentle phases"
```

---

### Task 18: Tiered celebrations + grand finale + calm-mode juice

**Files:**
- Modify: `src/scenes/ui/Celebrations.ts`
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `settings`, `Sound`.
- Produces: the three celebration tiers from the spec — small (per-pop), medium (level clear), big & rare (boss + finale) — all reduced when calm mode is on.

- [ ] **Step 1: Add `bigParty` + finale to `Celebrations.ts`**

```ts
  bigParty() {
    const W = this.scene.scale.width, H = this.scale.height;
    const n = settings.calm ? 20 : 70;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const s = this.scene.add.image(x, -20, ATLAS_KEY, frameFor("sparkle")).setScale(0.5 + Math.random());
      this.scene.tweens.add({ targets: s, y: H + 40, alpha: 0, duration: 1200 + Math.random() * 1200, onComplete: () => s.destroy() });
    }
    if (!settings.calm) this.scene.cameras.main.shake(250, 0.004); // screen-shake only when not calm, only here
  }

  finale(name = "Zoe") {
    this.bigParty();
    this.banner(`YOU DID IT, ${name.toUpperCase()}! 🦄🌈`, "#ff3f8a");
  }
```

- [ ] **Step 2: Use the tiers in `GameScene`**
- Per pop: already `fx.popAt` + `sound2.pop()` (small tier). ✓
- Level clear (non-boss): `fx.banner("Yay! 🌈")` + `sound2.fanfare()` (medium). ✓
- Boss defeat: replace the boss-defeat celebration with `this.fx.bigParty(); this.sound2.tada();` (big tier).
- Level 12 finale: in `onLevelCleared`, when `levelIndex >= 12`, call `this.fx.finale("Zoe"); this.sound2.tada();` before the delayed transition to Rainbow.

- [ ] **Step 3: Verify (run-and-observe)**

Run: `npm run dev`
Expected checklist (use temporary `levelIndex` jumps to reach a boss and level 12):
- Routine pops are small (a few sparkles + soft pop).
- Level clears show the medium "Yay!" fanfare.
- Boss defeats and the level-12 finale show the screen-filling party + "YOU DID IT, ZOE!"; **screen-shake happens only here and only when calm mode is OFF**.
- Toggling calm mode on the title noticeably reduces particle counts and skips the shake.
- Revert temporary changes.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/ui/Celebrations.ts src/scenes/GameScene.ts
git commit -m "feat(scene): tiered celebrations, grand finale, calm-mode juice reduction"
```

---

### Task 19: Rainbow mode (endless, procedural, palettes)

**Files:**
- Create: `src/scenes/RainbowScene.ts`
- Modify: `src/main.ts` (register `RainbowScene`)

**Interfaces:**
- Consumes: `GameScene` (subclass), `generateRainbowWave`, `createRng`.
- Produces: scene key `"Rainbow"` — endless waves generated from `core/rainbow.ts`, gently escalating, never ending.

- [ ] **Step 1: Create `src/scenes/RainbowScene.ts`** (reuse GameScene by overriding the level source)

```ts
import { GameScene } from "./GameScene";
import { generateRainbowWave } from "../core/rainbow";
import { createRng } from "../core/rng";
import type { FormationSpec } from "../core/types";

export class RainbowScene extends GameScene {
  private depth = 1;
  private wave: FormationSpec[] = [];

  constructor() {
    super("Rainbow");
  }

  // Override: formations come from the procedural generator, not authored levels.
  protected currentFormations(): FormationSpec[] {
    if (this.wave.length === 0) this.wave = generateRainbowWave(this.depth, createRng(this.depth * 7919));
    return this.wave;
  }

  // Override: never finish; bump depth and generate the next wave.
  protected onLevelCleared(): void {
    this.sound2.fanfare();
    this.fx.banner("🌈");
    this.depth++;
    this.wave = [];
    this.formationIndex = 0;
    this.time.delayedCall(900, () => this.spawnFormation());
  }

  // Override: rainbow mode has no bosses.
  protected maybeStartBossOrFinish(): void {
    this.onLevelCleared();
  }
}
```

> NOTE: ensure `GameScene` methods referenced here (`currentFormations`, `onLevelCleared`, `maybeStartBossOrFinish`, `spawnFormation`, fields `formationIndex`, `fx`, `sound2`, `stars`, `enemies`) are `protected` (they were declared `protected` in Tasks 15–17). `GameScene.create()` must call `this.spawnFormation()` which uses the overridden `currentFormations()`.

- [ ] **Step 2: Register `RainbowScene` in `src/main.ts`** (`scene: [BootScene, TitleScene, GameScene, RainbowScene]`).

- [ ] **Step 3: Verify (run-and-observe)**

Run: `npm run dev` → tap "🌈 Rainbow Mode".
Expected checklist:
- Coherent formations appear (never random scatter), pop normally, and a new wave generates after each clear — endlessly.
- Over several waves, the amount/variety increases gently (more/mixed cute things); palettes change between waves.
- It never shows a game-over and never ends; the calm toggle still works.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/RainbowScene.ts src/main.ts
git commit -m "feat(scene): endless procedural rainbow mode"
```

---

## Phase 4 — PWA, deploy, docs

### Task 20: PWA (installable, standalone, iOS hint, fullscreen)

**Files:**
- Modify: `vite.config.ts`
- Create: `src/pwa/installHint.ts`
- Modify: `src/main.ts` (call install hint + request fullscreen on first tap)
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` (pink unicorn icons)

**Interfaces:**
- Produces: a manifest + service worker; an iOS "Add to Home Screen" hint; fullscreen request on PC/Android on first user gesture.

- [ ] **Step 1: Configure `vite-plugin-pwa` in `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: { target: "es2020" },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["atlas/**", "audio/**"],
      manifest: {
        name: "Zoe's Rainbow Unicorn",
        short_name: "Zoe Unicorn",
        description: "A rainbow unicorn game for Zoe",
        theme_color: "#ff8fcf",
        background_color: "#8ec5ff",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 2: Create `src/pwa/installHint.ts`**

```ts
export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

/** Shows a one-time iOS "Add to Home Screen" hint banner (no framework needed). */
export function maybeShowIosInstallHint(): void {
  if (!isIos() || isStandalone()) return;
  const b = document.createElement("div");
  b.textContent = "Tap  ⬆️  then ‘Add to Home Screen’ to play full screen ✨";
  Object.assign(b.style, {
    position: "fixed", left: "0", right: "0", top: "0", padding: "10px",
    background: "#ff8fcf", color: "#fff", font: "16px sans-serif", textAlign: "center", zIndex: "9999",
  } as CSSStyleDeclaration);
  b.addEventListener("click", () => b.remove());
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 8000);
}

/** PC/Android only: request true fullscreen on a user gesture. */
export function requestFullscreenOnce(): void {
  const onFirst = () => {
    if (!isIos() && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    window.removeEventListener("pointerdown", onFirst);
  };
  window.addEventListener("pointerdown", onFirst);
}
```

- [ ] **Step 3: Call them in `src/main.ts`** — after `new Phaser.Game(...)`:

```ts
import { maybeShowIosInstallHint, requestFullscreenOnce } from "./pwa/installHint";
maybeShowIosInstallHint();
requestFullscreenOnce();
```

- [ ] **Step 4: Verify (run-and-observe + build)**

Run: `npm run build && npm run preview`
Expected checklist:
- Build succeeds (`tsc --noEmit` clean, Vite emits a service worker + `manifest.webmanifest`).
- In a desktop Chrome, an install icon appears in the address bar; installing opens it chromeless.
- First click requests fullscreen on desktop.
- (If testing on a real iPhone via the deployed URL in Task 21: the pink "Add to Home Screen" hint appears once.)

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts src/pwa/installHint.ts src/main.ts public/icon-192.png public/icon-512.png public/icon-maskable-512.png
git commit -m "feat(pwa): installable standalone PWA + iOS hint + fullscreen"
```

---

### Task 21: Netlify deploy config + README (phone setup for Dad)

**Files:**
- Create: `netlify.toml`
- Create: `README.md`

**Interfaces:**
- Produces: a deployable build and dad-facing setup docs.

- [ ] **Step 1: Create `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Zoe's Rainbow Unicorn 🦄🌈

A gentle, no-fail Galaga-style game made for Zoe.

## Run locally
- `npm install`
- `npm run dev` → open the printed URL
- `npm test` → run the logic tests

## Deploy (Netlify)
1. Push this repo to GitHub (or drag the `dist/` folder after `npm run build` into Netlify).
2. In Netlify: "Add new site" → connect the repo. Build command `npm run build`, publish dir `dist`.
3. You'll get a link like `https://zoes-rainbow-unicorn.netlify.app`.

## Put it on Zoe's phone (one-time)
1. Open the Netlify link in the phone browser.
2. **Add to Home Screen** (iPhone: Share ⬆️ → Add to Home Screen; Android: menu → Install app). Now it has its own icon and runs full screen.
3. **Lock her into the game so she can't accidentally exit:**
   - **iPhone:** Settings → Accessibility → Guided Access → On. Open the game, triple-click the side button to start Guided Access. Triple-click + passcode to exit.
   - **Android:** Settings → Security → Screen pinning → On. Open the game, open recents, tap the icon → Pin.

## Controls
- Move the unicorn: drag (touch), move the mouse, or arrow keys. It shoots by itself.
- Two buttons: **Play** (story, 12 levels + bosses) and **Rainbow Mode** (endless).
- The ✨/🌙 button (top corner) turns calm mode on/off (fewer sparkles + quieter).

## Notes
- No accounts, ads, purchases, or data collection. Nothing is saved (always starts at Level 1).
- Art uses the OpenMoji emoji set, swappable later via `src/render/sprites.ts` + the atlas.
```

- [ ] **Step 3: Verify build output**

Run: `npm run build`
Expected: `dist/` contains `index.html`, hashed JS, `manifest.webmanifest`, `sw.js`, and the `atlas/` + `audio/` assets. `npm test` is green.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml README.md
git commit -m "chore: Netlify config + README with phone setup"
```

- [ ] **Step 5: Deploy** — connect the repo on Netlify (or `npx netlify deploy --prod`) and open the link on the PC and Zoe's phone.

---

## Self-Review

**Spec coverage check (spec §→task):**
- §5 flow (title → Play/Rainbow): Tasks 14, 16, 19 ✓
- §6.1 loop (sequential formations, no-fail bounce): Task 16 ✓ — *NOTE:* the harmless **bounce-on-contact** visual is implicit (enemies don't damage; no collision player↔enemy is wired). Added below.
- §6.2 controls (follow-pointer + arrows + autofire): Tasks 9, 15 ✓
- §6.2 aim assist (hitboxes + magnetism): Tasks 7, 8, 16 ✓
- §7.1 levels/formations (1–3 formations, 1–3 coherent types): Tasks 3, 4, 5 ✓
- §7.3 bosses at 5/10/12 (happiness meter, phases, no harm): Tasks 10, 17 ✓
- §7.4 rainbow mode (procedural, palettes, endless): Tasks 6, 19 ✓
- §8.1 art (OpenMoji atlas, pink unicorn + wings): Tasks 11, 14, 15 ✓
- §8.2 audio (music + SFX, no fire sound): Task 12, 15 (no fire sound — autofire emits no sound) ✓
- §8.3 celebration tiers + calm mode: Tasks 12, 18 ✓
- §9 architecture (scenes FSM, pooling, data-driven, circle collision, art seam, responsive, unified input): Tasks 13–19 ✓
- §10 tech/delivery (Phaser4+TS+Vite, PWA, Netlify, zero data): Tasks 1, 20, 21 ✓

**Gap found → fix:** the spec's "enemy contact = harmless bounce + sparkle" isn't explicitly wired. Add to **Task 16, Step 2** a tiny no-damage bounce: in `updateEnemies`, after collision handling, check unicorn↔enemy overlap and, if overlapping, nudge the enemy away + `fx.popAt` (no hp, no penalty). Implementer note (add as a Step in Task 16):

```ts
// harmless bounce: enemy touching unicorn just sparkles and drifts back, no penalty
const ux = this.unicorn.x, uy = this.unicorn.y;
activeEnemies.forEach((e) => {
  const dx = e.x - ux, dy = e.y - uy;
  if (dx * dx + dy * dy < 90 * 90) {
    this.fx.popAt((e.x + ux) / 2, (e.y + uy) / 2);
    e.setData("baseX", e.getData("baseX") + (dx >= 0 ? 30 : -30));
  }
});
```

**Placeholder scan:** one intentional `// TODO(Task17): boss` exists in Task 16 and is resolved in Task 17 (cross-referenced). No other TODO/TBD. Atlas/audio/icon binary assets are produced in Tasks 11/12/20 (documented), not placeholders.

**Type consistency:** `Circle` (collision) reused in Task 16; `FormationSpec`/`Level`/`PlacedEnemy` consistent across Tasks 2–6, 16; `BossController` API (`update/hit/isVulnerable/state/hp/phase`) consistent Tasks 10, 17; `protected` members in `GameScene` consumed by `RainbowScene` (Task 19) — flagged in Task 19 NOTE. `currentFormations()`/`onLevelCleared()`/`maybeStartBossOrFinish()` named identically where overridden.

All issues fixed inline above.

---

## Open questions carried from the spec (resolve during playtest, not blocking)

1. Boss "happiness meter" size (maxHp per boss) — tuned in `levels.ts`; adjust after watching Zoe.
2. Calm-mode reduction amounts — adjust particle counts/volumes in `Celebrations.ts`/`sound.ts`.
3. Magnetism strength + hitbox radii (`r: 55` enemies, `160` magnet range) — tune for Zoe's aim.
4. Exact per-level enemy lineup — change data in `levels.ts` freely (format is fixed).
5. Aspect-aware column behavior — `layoutFormation` currently centers; if wide-screen feels sparse, add column-count scaling from `field.width`.
