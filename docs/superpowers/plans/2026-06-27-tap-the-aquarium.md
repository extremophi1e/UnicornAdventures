# Tap the Aquarium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth game mode, "Tap the Aquarium" — a calm, non-destructive aquarium sandbox where sea-creatures drift sideways and tapping one triggers a weighted-random surprise (the creature is never destroyed).

**Architecture:** A standalone `Phaser.Scene` (`AquariumScene`) renders a pooled group of drifting animated-emoji sea creatures over a new shape-based `AquariumBackground`. A new pure module (`src/core/aquarium.ts`, Vitest-tested) owns the entire surprise engine: a data catalog of reactions in three rarity tiers, a `pickReaction` selector with cap-filtering + pity/min-gap + no-immediate-repeat, and `netAdds` for cap-safe population math. The scene reuses `pickNearestWithinRadius` (`src/core/pop.ts`) for multi-touch, `spawnEmoji`/`resetEmoji` for sprites, and `Celebrations`/`Sound` for juice. No score, no fail, no HUD.

**Tech Stack:** Phaser 4 (WebGL), TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), Vite, Vitest, sharp/https/node build scripts. No new runtime dependencies.

## Global Constraints

- **No new runtime dependencies** — Phaser 4 + existing helpers only.
- **Reuse, don't duplicate:** multi-touch reuses `pickNearestWithinRadius` from `src/core/pop.ts`; sprites use `spawnEmoji`/`resetEmoji`; juice uses `Celebrations` (`popAt`/`banner`/`bigParty`) + `Sound` (`fanfare`/`tada`); music wiring copies `PopScene`'s robust-autoplay pattern verbatim.
- **Pure logic is Vitest-tested** (`src/core/aquarium.ts`); scenes/backgrounds/scripts are not unit-tested (verified by running the game in Claude Preview).
- **Existing modes must be untouched behaviorally.** No new emoji are added (the aquarium reuses the 9 existing aquatic creatures). The only `TitleScene` change is the button list (a 7th button on a new 4th grid row + two display-label renames; Peekaboo's grid + button stay).
- **Surprise, not Skinner box:** NO score, count, currency, collection meter, persistence, or "tap to unlock." Each tap is guaranteed a pleasant reaction; rarity only varies which one.
- **Unbreakable & calm:** no fail state; population can never overflow (hard cap + cap-filter) or empty (ambient recycle); reactions are fire-and-forget and overlap-safe; photosensitivity-safe (no strobe — slow low-contrast rainbow); honor `prefers-reduced-motion`.
- **Phaser 4 gotchas:** no `setTintFill()` (use `setTint`/`clearTint`); no Tween `Timeline` and do NOT use `this.add.timeline` for duration-driven sequences — sequence with `this.time.delayedCall` + chained/concurrent tweens; avoid runtime `generateTexture` (blank-texture gotcha) — backgrounds/bubbles are shape GameObjects.
- **Exact names/values:** scene key `"Aquarium"`; title button glyph `🐠`, label `"Tap the Aquarium"`, color `0x0077b6`; renames (labels only, scene keys unchanged): `"Rainbow Shoot"`→`"Star Blaster"` (key `"Game"`), `"Rainbow Catch"`→`"Catch the Cuties"` (key `"Catch"`); baseline ~`7`, hard cap `16`, tap radius `90`, nap after `5` taps for `2.5 s`, rare min-gap `6`, pity ceiling `22`, tier weights Common `65` / Uncommon `30` / Rare `5`.
- **TypeScript must compile** (`npx tsc --noEmit`) and **`npm run build`** must pass at every task; **`npm test`** must stay green (record the baseline count via `npm test` at the start of Task 2) and grow by the Task 2 aquarium tests.
- **Reference spec:** `docs/superpowers/specs/2026-06-27-tap-the-aquarium-design.md`. **Reference brief:** `docs/superpowers/research/2026-06-27-tap-the-aquarium-brief.md`.

---

### Task 1: Cast — use the 9 existing aquatic creatures (NO new assets)

> **SUPERSEDED (2026-06-27):** The original plan to add real fish (🐟/🐡/🦈/🐬) was dropped after hands-on probing. Noto animates them as swim-across / inflate-deflate / arc, so they drop to **0–7.5% opacity mid-loop** (vs ≥33% for proven creatures) and would flicker/vanish as drifting sprites — failing the project's ~15% loop-safety bar. **No new emoji are added.** The aquarium cast uses the **9 steady aquatic creatures already in `src/render/emoji.ts`**: whale, turtle, octopus, crab, lobster, jellyfish, penguin, seal, otter. 🐠 remains the title-button glyph only. **Nothing to build here** — confirm the 9 keys exist (`grep -E "^  (whale|turtle|octopus|crab|lobster|jellyfish|penguin|seal|otter):" src/render/emoji.ts`) and proceed to Task 2. The original (now void) steps are retained below for history only — do NOT execute them.

---

### Task 1 (VOID — historical): Assets — add fish/blowfish/shark sea-creatures (+ dolphin, probe-gated)

**Files:**
- Modify: `scripts/build-emoji.mjs` (the `TYPES` map)
- Generated: `public/emoji/fish.png`, `public/emoji/blowfish.png`, `public/emoji/shark.png` (+ `dolphin.png` if it passes), and a regenerated `src/render/emoji.ts`
- Create (probe helper): `scripts/probe-emoji.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: new emoji keys `fish`, `blowfish`, `shark` (and maybe `dolphin`) in `src/render/emoji.ts`, auto-loaded + auto-animated by `BootScene` (which iterates `EMOJI_DEFS`). Note `otter`, `octopus`, `turtle`, `whale`, `crab`, `lobster`, `jellyfish`, `penguin`, `seal` already exist.

- [ ] **Step 1: Add the new sea-creatures to `TYPES`**

In `scripts/build-emoji.mjs`, append to the `TYPES` object (just before the closing `};` at line ~59). These three codepoints are verified present in Noto's animated set (per the research brief); `dolphin` is included but probe-gated in Step 3:

```js
  // Tap the Aquarium — real fish (verified present in Noto animated set).
  fish: "1f41f", blowfish: "1f421", shark: "1f988", dolphin: "1f42c",
```

- [ ] **Step 2: Create the loop-safety probe helper**

Create `scripts/probe-emoji.mjs` (downloads a Noto animated GIF and prints the opaque-pixel % of the first / middle / last frame — a creature that "fades" mid-loop shows a much lower last-frame %; the brief flags `dolphin` as the prime suspect):

```js
/**
 * probe-emoji.mjs — loop-safety probe for a Noto animated emoji.
 * Usage: node scripts/probe-emoji.mjs 1f42c
 * Prints opaque-pixel % for the first/middle/last frame. If the last frame's %
 * is much lower than the first (e.g. < ~60% of it), the animation fades out
 * mid-loop and should NOT be used as a steady drifting sprite.
 */
import sharp from "sharp";
import https from "https";

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume(); fetchBuffer(res.headers.location, redirects + 1).then(resolve, reject); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
  });
}

async function opaquePct(raw, w, h, top) {
  const { data } = await sharp(raw, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: 0, top, width: w, height: w }).raw().toBuffer({ resolveWithObject: true });
  let opaque = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 24) opaque++;
  return (100 * opaque) / (w * w);
}

const cp = process.argv[2];
if (!cp) { console.error("usage: node scripts/probe-emoji.mjs <codepoint>"); process.exit(1); }
const gif = await fetchBuffer(`https://fonts.gstatic.com/s/e/notoemoji/latest/${cp}/512.gif`);
const meta = await sharp(gif, { animated: true }).metadata();
const w = meta.width, h = meta.pageHeight ?? meta.height, pages = meta.pages ?? 1;
const { data } = await sharp(gif, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const raw = Buffer.from(data);
const first = await opaquePct(raw, w, h * pages, 0);
const mid = await opaquePct(raw, w, h * pages, Math.floor(pages / 2) * h);
const last = await opaquePct(raw, w, h * pages, (pages - 1) * h);
console.log(`${cp}: first=${first.toFixed(1)}%  mid=${mid.toFixed(1)}%  last=${last.toFixed(1)}%  -> ${last >= first * 0.6 ? "LOOP-SAFE" : "FADES (drop it)"}`);
```

- [ ] **Step 3: Probe the dolphin**

Run: `node scripts/probe-emoji.mjs 1f42c`
- If it prints **`LOOP-SAFE`**: keep `dolphin` in `TYPES` and include it in `AQUARIUM_TYPES` in Task 5.
- If it prints **`FADES (drop it)`**: remove `dolphin: "1f42c",` from the `TYPES` edit in Step 1, and do NOT add `dolphin` to `AQUARIUM_TYPES` in Task 5.

(Also spot-probe the others if desired — `1f41f`, `1f421`, `1f988` should all be LOOP-SAFE.)

- [ ] **Step 4: Regenerate the emoji sheets + manifest**

Run: `npm run emoji` (fallback if no such script: `node scripts/build-emoji.mjs`).
Expected: it downloads + builds every type, printing a line per emoji (incl. `fish`, `blowfish`, `shark`, and `dolphin` if kept), and ends with `Wrote .../src/render/emoji.ts (N emoji)`.
Verify: `src/render/emoji.ts` now contains `fish:`, `blowfish:`, `shark:` entries, and the PNGs exist (`ls public/emoji/fish.png public/emoji/blowfish.png public/emoji/shark.png`).

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass (the new sheets are bundled; `BootScene` auto-loads them via `EMOJI_DEFS`).

- [ ] **Step 6: Commit**

```bash
git add scripts/build-emoji.mjs scripts/probe-emoji.mjs src/render/emoji.ts public/emoji/fish.png public/emoji/blowfish.png public/emoji/shark.png
# include public/emoji/dolphin.png only if it passed the probe:
git add public/emoji/dolphin.png 2>/dev/null || true
git commit -m "feat(aquarium): add fish/blowfish/shark sea-creature emoji (+ probe helper)"
```

---

### Task 2: Pure surprise engine — `src/core/aquarium.ts` (+ tests)

**Files:**
- Create: `src/core/aquarium.ts`
- Test: `src/core/aquarium.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no imports).
- Produces:
  - `type ReactionTier = "common" | "uncommon" | "rare"`
  - `type ReactionKind = "react" | "split" | "school"`
  - `interface Reaction { id: string; tier: ReactionTier; kind: ReactionKind; schoolCount?: number }`
  - `const REACTIONS: Reaction[]` (6 common, 6 uncommon, 3 rare)
  - `const MIN_GAP = 6`, `const PITY_CEILING = 22`, `const TIER_WEIGHTS: Record<ReactionTier, number>`
  - `interface AquariumState { tapsSinceRare: number; lastReactionId: string | null }`
  - `function initialAquariumState(): AquariumState`
  - `function pickReaction(state: AquariumState, rng: () => number, opts: { atCap: boolean }): { reaction: Reaction; state: AquariumState }`
  - `function netAdds(reaction: Reaction, remainingCapacity: number): number`

- [ ] **Step 1: Write the failing tests**

Create `src/core/aquarium.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  pickReaction, netAdds, initialAquariumState, REACTIONS,
  MIN_GAP, PITY_CEILING, type AquariumState, type Reaction,
} from "./aquarium";

// Small deterministic RNG (mulberry32) for seeded distribution tests.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const byId = (id: string) => REACTIONS.find((r) => r.id === id) as Reaction;

describe("REACTIONS catalog", () => {
  it("has 6 common, 6 uncommon, 3 rare", () => {
    expect(REACTIONS.filter((r) => r.tier === "common")).toHaveLength(6);
    expect(REACTIONS.filter((r) => r.tier === "uncommon")).toHaveLength(6);
    expect(REACTIONS.filter((r) => r.tier === "rare")).toHaveLength(3);
  });
  it("marks split as kind 'split' and school as kind 'school'", () => {
    expect(byId("split").kind).toBe("split");
    expect(byId("school").kind).toBe("school");
    expect(byId("school").schoolCount).toBeGreaterThan(0);
  });
});

describe("pickReaction — pity ceiling", () => {
  it("forces a rare once tapsSinceRare hits PITY_CEILING", () => {
    const state: AquariumState = { tapsSinceRare: PITY_CEILING, lastReactionId: null };
    const { reaction } = pickReaction(state, () => 0, { atCap: false });
    expect(reaction.tier).toBe("rare");
  });
  it("resets tapsSinceRare to 0 after a rare and increments otherwise", () => {
    const rare = pickReaction({ tapsSinceRare: PITY_CEILING, lastReactionId: null }, () => 0, { atCap: false });
    expect(rare.state.tapsSinceRare).toBe(0);
    const common = pickReaction({ tapsSinceRare: 3, lastReactionId: null }, () => 0, { atCap: false });
    expect(common.state.tapsSinceRare).toBe(4);
  });
});

describe("pickReaction — min-gap", () => {
  it("never returns a rare while tapsSinceRare < MIN_GAP, across many rng values", () => {
    for (let g = 0; g < MIN_GAP; g++) {
      for (let r = 0; r < 50; r++) {
        const rng = () => r / 50; // sweep [0,1)
        const { reaction } = pickReaction({ tapsSinceRare: g, lastReactionId: null }, rng, { atCap: false });
        expect(reaction.tier).not.toBe("rare");
      }
    }
  });
  it("does not fire a rare immediately after a rare (gap resets to 0)", () => {
    let state = pickReaction({ tapsSinceRare: PITY_CEILING, lastReactionId: null }, () => 0, { atCap: false }).state;
    const next = pickReaction(state, () => 0.999, { atCap: false });
    expect(next.reaction.tier).not.toBe("rare");
  });
});

describe("pickReaction — cap filter", () => {
  it("never returns an additive reaction (split/school) when atCap", () => {
    const rng = mulberry32(1);
    let state = initialAquariumState();
    for (let i = 0; i < 2000; i++) {
      const res = pickReaction(state, rng, { atCap: true });
      expect(res.reaction.kind).toBe("react");
      expect(["split", "school"]).not.toContain(res.reaction.id);
      state = res.state;
    }
  });
  it("can still force a (non-additive) rare at cap via pity", () => {
    const { reaction } = pickReaction({ tapsSinceRare: PITY_CEILING, lastReactionId: null }, () => 0, { atCap: true });
    expect(reaction.tier).toBe("rare");
    expect(reaction.kind).toBe("react"); // school filtered out; shockwave/treasure remain
  });
});

describe("pickReaction — no immediate repeat", () => {
  it("never returns the same id twice in a row over a long seeded run", () => {
    const rng = mulberry32(42);
    let state = initialAquariumState();
    let last: string | null = null;
    for (let i = 0; i < 3000; i++) {
      const res = pickReaction(state, rng, { atCap: false });
      if (last !== null) expect(res.reaction.id).not.toBe(last);
      last = res.reaction.id;
      state = res.state;
    }
  });
});

describe("pickReaction — tier distribution (sanity)", () => {
  it("is roughly 65/30/5 over many seeded draws", () => {
    const rng = mulberry32(7);
    let state = initialAquariumState();
    const counts = { common: 0, uncommon: 0, rare: 0 };
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const res = pickReaction(state, rng, { atCap: false });
      counts[res.reaction.tier]++;
      state = res.state;
    }
    expect(counts.common / N).toBeGreaterThan(0.55);
    expect(counts.common / N).toBeLessThan(0.75);
    expect(counts.uncommon / N).toBeGreaterThan(0.22);
    expect(counts.uncommon / N).toBeLessThan(0.38);
    expect(counts.rare / N).toBeGreaterThan(0.02);
    expect(counts.rare / N).toBeLessThan(0.10);
  });
});

describe("netAdds", () => {
  it("returns 1 for split with room, 0 with no room", () => {
    expect(netAdds(byId("split"), 5)).toBe(1);
    expect(netAdds(byId("split"), 0)).toBe(0);
  });
  it("clamps school to remaining capacity", () => {
    expect(netAdds(byId("school"), 10)).toBe(byId("school").schoolCount);
    expect(netAdds(byId("school"), 2)).toBe(2);
  });
  it("returns 0 for non-additive reactions", () => {
    expect(netAdds(byId("spin"), 10)).toBe(0);
    expect(netAdds(byId("shockwave"), 10)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/aquarium.test.ts`
Expected: FAIL — `Failed to resolve import "./aquarium"`.

- [ ] **Step 3: Write the implementation**

Create `src/core/aquarium.ts`:

```ts
// Pure, framework-free surprise engine for Tap the Aquarium. No Phaser imports
// — unit-tested headlessly with a seeded rng. This module is the single source
// of truth for WHICH reaction a tap triggers and HOW MANY creatures it adds.

export type ReactionTier = "common" | "uncommon" | "rare";
export type ReactionKind = "react" | "split" | "school";

export interface Reaction {
  id: string;
  tier: ReactionTier;
  kind: ReactionKind;     // "react" = non-additive; "split"/"school" = additive
  schoolCount?: number;   // creatures a "school" tries to add
}

// The full catalog (data, no behavior — the scene maps id -> visual effect).
export const REACTIONS: Reaction[] = [
  // Common — gentle, fires most taps.
  { id: "spin", tier: "common", kind: "react" },
  { id: "wiggle", tier: "common", kind: "react" },
  { id: "bubble", tier: "common", kind: "react" },
  { id: "squash", tier: "common", kind: "react" },
  { id: "colorflash", tier: "common", kind: "react" },
  { id: "heart", tier: "common", kind: "react" },
  // Uncommon — showy.
  { id: "split", tier: "uncommon", kind: "split" },
  { id: "bubblestream", tier: "uncommon", kind: "react" },
  { id: "zoom", tier: "uncommon", kind: "react" },
  { id: "morph", tier: "uncommon", kind: "react" },
  { id: "backflip", tier: "uncommon", kind: "react" },
  { id: "giant", tier: "uncommon", kind: "react" },
  // Rare — the big "whoa" jackpots.
  { id: "school", tier: "rare", kind: "school", schoolCount: 4 },
  { id: "shockwave", tier: "rare", kind: "react" },
  { id: "treasure", tier: "rare", kind: "react" },
];

export const TIER_WEIGHTS: Record<ReactionTier, number> = { common: 65, uncommon: 30, rare: 5 };
export const MIN_GAP = 6;        // taps since last rare before a rare is eligible
export const PITY_CEILING = 22;  // taps since last rare that force a rare next

export interface AquariumState {
  tapsSinceRare: number;
  lastReactionId: string | null;
}

export function initialAquariumState(): AquariumState {
  return { tapsSinceRare: 0, lastReactionId: null };
}

const TIER_ORDER: ReactionTier[] = ["common", "uncommon", "rare"];

function weightedTier(weights: Array<[ReactionTier, number]>, rng: () => number): ReactionTier {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [t, w] of weights) {
    if (roll < w) return t;
    roll -= w;
  }
  return weights[weights.length - 1][0]; // floating-point safety net
}

// Pick the next reaction. Pure + deterministic given `rng` (in [0,1)).
//   1. atCap -> drop additive reactions (split/school) from the pool first.
//   2. tier via pity/min-gap weighting (rare excluded below MIN_GAP, forced at PITY_CEILING).
//   3. uniform pick within the tier, excluding lastReactionId (no immediate repeat).
export function pickReaction(
  state: AquariumState,
  rng: () => number,
  opts: { atCap: boolean },
): { reaction: Reaction; state: AquariumState } {
  const pool = opts.atCap ? REACTIONS.filter((r) => r.kind === "react") : REACTIONS;
  const tiersPresent = new Set(pool.map((r) => r.tier));

  const rareEligible = tiersPresent.has("rare") && state.tapsSinceRare >= MIN_GAP;
  const forceRare = tiersPresent.has("rare") && state.tapsSinceRare >= PITY_CEILING;

  let tier: ReactionTier;
  if (forceRare) {
    tier = "rare";
  } else {
    const weights: Array<[ReactionTier, number]> = [];
    for (const t of TIER_ORDER) {
      if (!tiersPresent.has(t)) continue;
      if (t === "rare" && !rareEligible) continue; // redistribute by omission
      weights.push([t, TIER_WEIGHTS[t]]);
    }
    tier = weightedTier(weights, rng);
  }

  const inTier = pool.filter((r) => r.tier === tier);
  let candidates = inTier.filter((r) => r.id !== state.lastReactionId);
  if (candidates.length === 0) candidates = inTier; // single-member-tier edge
  const reaction = candidates[Math.floor(rng() * candidates.length)];

  return {
    reaction,
    state: {
      tapsSinceRare: tier === "rare" ? 0 : state.tapsSinceRare + 1,
      lastReactionId: reaction.id,
    },
  };
}

// How many creatures this reaction adds, clamped to remaining capacity.
export function netAdds(reaction: Reaction, remainingCapacity: number): number {
  if (remainingCapacity <= 0) return 0;
  if (reaction.kind === "split") return Math.min(1, remainingCapacity);
  if (reaction.kind === "school") return Math.min(reaction.schoolCount ?? 0, remainingCapacity);
  return 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/aquarium.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Verify the whole suite + typecheck**

Run: `npm test` (expect the prior count + the new aquarium tests, all green) and `npx tsc --noEmit` (no output).

- [ ] **Step 6: Commit**

```bash
git add src/core/aquarium.ts src/core/aquarium.test.ts
git commit -m "feat(aquarium): pure surprise engine (catalog + pickReaction + netAdds) + tests"
```

---

### Task 3: Aquarium background — `src/scenes/ui/AquariumBackground.ts`

**Files:**
- Create: `src/scenes/ui/AquariumBackground.ts`

**Interfaces:**
- Consumes: nothing (mirrors `UnderwaterBackground`'s shape).
- Produces: `class AquariumBackground extends Phaser.GameObjects.Container` with `constructor(scene, width, height)`, `resize(width, height): void`, `update(dt: number, _width: number): void`.

- [ ] **Step 1: Write the implementation**

Create `src/scenes/ui/AquariumBackground.ts` (shape-based — distinct from Pop's open-water `UnderwaterBackground`: brighter blue water + sandy floor + swaying kelp + coral clumps):

```ts
import Phaser from "phaser";

// Shape-based fish-tank background for Tap the Aquarium: a bright blue->aqua
// gradient, a sandy floor, a few swaying kelp fronds, coral/rock clumps, gentle
// rising bubbles and soft light rays. Deliberately brighter and "tank-like"
// (floor + plants) so it reads differently from Pop's open-water
// UnderwaterBackground. Calm, low-contrast so it never competes with the fish.
export class AquariumBackground extends Phaser.GameObjects.Container {
  private water: Phaser.GameObjects.Graphics;
  private decor: Phaser.GameObjects.Graphics;   // floor + coral (static)
  private kelp: Phaser.GameObjects.Graphics;    // redrawn each frame (sway)
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

    this.water = scene.add.graphics(); this.add(this.water);
    this.rays = scene.add.graphics(); this.add(this.rays);
    this.kelp = scene.add.graphics(); this.add(this.kelp);
    this.decor = scene.add.graphics(); this.add(this.decor);

    for (let i = 0; i < 22; i++) {
      const b = scene.add.circle(0, 0, 3 + Math.random() * 10, 0xffffff, 0.16);
      this.bubbles.push(b);
      this.bubbleSpeed.push(18 + Math.random() * 44);
      this.add(b);
    }

    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this._w = width;
    this._h = height;

    // Bright blue -> aqua vertical gradient via stacked bands.
    this.water.clear();
    const bands = [0x1f6fd6, 0x2a86e0, 0x36a3e8, 0x57c4e6, 0x86ddde];
    const bandH = height / bands.length;
    bands.forEach((c, i) => this.water.fillStyle(c, 1).fillRect(0, i * bandH, width, bandH + 1));

    // Sandy floor + coral/rock clumps (static).
    this.decor.clear();
    const floorH = 70;
    this.decor.fillStyle(0xe8d8a6, 1).fillRect(0, height - floorH, width, floorH);
    this.decor.fillStyle(0xddc987, 1);
    for (let i = 0; i < Math.ceil(width / 60); i++) {
      this.decor.fillCircle(i * 60 + 30, height - floorH + 6, 10 + (i % 3) * 4);
    }
    const coral = [0xff8fab, 0xff6f91, 0xffc36b];
    for (let i = 0; i < 3; i++) {
      const cx = (width / 3) * (i + 0.5);
      this.decor.fillStyle(coral[i % coral.length], 0.9);
      this.decor.fillCircle(cx - 14, height - floorH - 6, 14);
      this.decor.fillCircle(cx + 6, height - floorH - 2, 18);
      this.decor.fillCircle(cx + 24, height - floorH - 8, 12);
    }

    for (const b of this.bubbles) b.setPosition(Math.random() * width, Math.random() * height);
    this.drawKelp();
    this.drawRays();
  }

  private drawKelp(): void {
    this.kelp.clear();
    const floorY = this._h - 70;
    const stalks = 5;
    for (let s = 0; s < stalks; s++) {
      const baseX = (this._w / stalks) * (s + 0.5);
      this.kelp.fillStyle(0x2f9e6e, 0.85);
      const segs = 8, segH = 22, wdt = 9;
      for (let i = 0; i < segs; i++) {
        const y = floorY - i * segH;
        const sway = Math.sin(this._t * 1.1 + s + i * 0.5) * (3 + i * 1.5);
        this.kelp.fillCircle(baseX + sway, y, wdt - i * 0.6);
      }
    }
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
    const floorY = this._h - 70;
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      b.y -= this.bubbleSpeed[i] * dt;
      b.x += Math.sin(this._t * 1.5 + i) * 8 * dt;
      if (b.y < -20) { b.y = floorY; b.x = Math.random() * this._w; }
    }
    this.drawKelp();
    this.drawRays();
  }
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass (`_width` is intentionally unused to match the `update(dt, _width)` signature used by the scene's update wiring).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ui/AquariumBackground.ts
git commit -m "feat(aquarium): fish-tank background (blue water, sandy floor, swaying kelp, coral)"
```

---

### Task 4: Audio — music download + SFX synth + Boot loads + credits

**Files:**
- Create: `scripts/build-aquarium-audio.mjs` (music), `scripts/build-aquarium-sfx.mjs` (blub/sproing/chime)
- Modify: `package.json` (scripts), `src/scenes/BootScene.ts` (preload), `public/audio/CREDITS.md`, `README.md`
- Generated: `public/audio/aquarium.mp3`, `public/audio/blub.wav`, `public/audio/sproing.wav`, `public/audio/chime.wav`

**Interfaces:**
- Consumes: nothing.
- Produces: audio keys `"aquarium"`, `"blub"`, `"sproing"`, `"chime"` loaded in Boot (used by Tasks 5–7).

- [ ] **Step 1: Create the music download script**

Create `scripts/build-aquarium-audio.mjs` (mirrors `scripts/build-pop-audio.mjs`; one calm CC-BY default the user can swap):

```js
/**
 * build-aquarium-audio.mjs
 * Downloads one calm royalty-free Kevin MacLeod track (CC-BY) as the default
 * music for Tap the Aquarium. Output: public/audio/aquarium.mp3
 * The user can replace this file with their own track (keep the filename).
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-aquarium-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACK = {
  file: "aquarium.mp3",
  title: "Carefree",
  url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3",
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
  catch (e) { console.error(`FAILED: ${e.message} — pick another calm CC-BY track and update the URL + CREDITS.md`); process.exitCode = 1; }
}
main();
```

- [ ] **Step 2: Create the SFX synth script (dependency-free)**

Create `scripts/build-aquarium-sfx.mjs` (synthesizes three short reaction sounds as 16-bit PCM WAVs — no external deps):

```js
/**
 * build-aquarium-sfx.mjs
 * Synthesizes three short reaction SFX for Tap the Aquarium as 16-bit mono WAVs.
 *   blub.wav    — soft bubble (descending sine)
 *   sproing.wav — comedic split "boing" (rising sine + vibrato)
 *   chime.wav   — bright jackpot bell (two partials, exp decay)
 * No dependencies. Run: node scripts/build-aquarium-sfx.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "audio");
const SR = 44100;

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buf;
}
function render(dur, fn) {
  const n = Math.floor(SR * dur);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = fn(i / SR);
  return a;
}
const env = (t, dur, atk = 0.005, rel = 0.08) =>
  Math.max(0, Math.min(Math.min(1, t / atk), Math.min(1, (dur - t) / rel)));

const blub = render(0.20, (t) => {
  const f = 220 - 120 * (t / 0.20);
  return Math.sin(2 * Math.PI * f * t) * 0.5 * env(t, 0.20, 0.004, 0.10);
});
const sproing = render(0.26, (t) => {
  const f = 180 + 580 * Math.min(1, t / 0.18) + 40 * Math.sin(2 * Math.PI * 18 * t);
  return Math.sin(2 * Math.PI * f * t) * 0.5 * env(t, 0.26, 0.004, 0.12);
});
const chime = render(0.60, (t) => {
  const e = Math.exp(-6 * t);
  return (Math.sin(2 * Math.PI * 880 * t) * 0.6 + Math.sin(2 * Math.PI * 1320 * t) * 0.3) * e * 0.5;
});

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "blub.wav"), wav(blub));
writeFileSync(join(OUT, "sproing.wav"), wav(sproing));
writeFileSync(join(OUT, "chime.wav"), wav(chime));
console.log("wrote blub.wav, sproing.wav, chime.wav");
```

- [ ] **Step 3: Add the npm scripts**

In `package.json` `"scripts"`, add (next to the other audio scripts):

```json
    "aquarium-audio": "node scripts/build-aquarium-audio.mjs",
    "aquarium-sfx": "node scripts/build-aquarium-sfx.mjs",
```

- [ ] **Step 4: Run both to fetch/generate the assets**

Run: `npm run aquarium-audio` then `npm run aquarium-sfx`
Expected: `Downloading Carefree -> aquarium.mp3 ... ok` and `wrote blub.wav, sproing.wav, chime.wav`.
Verify: `ls public/audio/aquarium.mp3 public/audio/blub.wav public/audio/sproing.wav public/audio/chime.wav` (the mp3 should be > 1 MB).
(If the music URL 404s, pick any other calm CC-BY track, update `TRACK.url`/`title` + CREDITS.md, and re-run.)

- [ ] **Step 5: Load the assets in Boot**

In `src/scenes/BootScene.ts` `preload()`, add after the `this.load.audio("gumball", ...)` line:

```ts
    this.load.audio("aquarium", ["audio/aquarium.mp3"]);
    this.load.audio("blub", ["audio/blub.wav"]);
    this.load.audio("sproing", ["audio/sproing.wav"]);
    this.load.audio("chime", ["audio/chime.wav"]);
```

- [ ] **Step 6: Credit the music**

In `public/audio/CREDITS.md`, add a line in the same style as the existing entries:

```markdown
- aquarium.mp3 — "Carefree" by Kevin MacLeod (incompetech.com), CC-BY 4.0. Default track for Tap the Aquarium; user-swappable. (blub/sproing/chime SFX are synthesized by scripts/build-aquarium-sfx.mjs.)
```

- [ ] **Step 7: Note it in the README**

In `README.md`, add `npm run aquarium-audio` and `npm run aquarium-sfx` alongside the other asset-build scripts (one line each, matching the existing tone). The mode itself is added to the modes list in Task 5.

- [ ] **Step 8: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass; the build precaches the new audio.

- [ ] **Step 9: Commit**

```bash
git add scripts/build-aquarium-audio.mjs scripts/build-aquarium-sfx.mjs package.json src/scenes/BootScene.ts public/audio/CREDITS.md README.md public/audio/aquarium.mp3 public/audio/blub.wav public/audio/sproing.wav public/audio/chime.wav
git commit -m "feat(aquarium): music download + synthesized blub/sproing/chime SFX + Boot load"
```

---

### Task 5: AquariumScene core (drift, multi-touch, common reactions, sleepy) + wiring

**Files:**
- Create: `src/scenes/AquariumScene.ts`
- Modify: `src/main.ts` (register scene), `src/scenes/TitleScene.ts` (6th button + 2 renames + re-space)

**Interfaces:**
- Consumes:
  - `src/core/aquarium.ts`: `pickReaction`, `netAdds`, `initialAquariumState`, `type AquariumState`, `type Reaction`.
  - `src/core/pop.ts`: `pickNearestWithinRadius(px, py, targets, radius): number`.
  - `src/render/emojiSprite.ts`: `spawnEmoji(scene, x, y, type): Sprite`, `resetEmoji(sprite, type, x, y): Sprite`.
  - `src/audio/sound.ts`: `class Sound` (`fanfare()`, `tada()`).
  - `src/scenes/ui/Celebrations.ts`: `class Celebrations` (`popAt(x,y)`, `banner(text,color?,holdMs?)`, `bigParty()`).
  - `src/scenes/ui/AquariumBackground.ts` (Task 3).
- Produces: scene key `"Aquarium"`; private methods `spawnFishAt`, `emitBubbles`, `applyReaction`, and the common-reaction handlers (`rSpin`/`rWiggle`/`rBubble`/`rSquash`/`rColorFlash`/`rHeart`) that Tasks 6–7 extend.

- [ ] **Step 1: Create the scene**

Create `src/scenes/AquariumScene.ts`. (Common reactions + sleepy damper are implemented now; Uncommon/Rare reactions fall through `applyReaction`'s `default` to a gentle wiggle until Tasks 6–7 add them — safe, never broken.)

```ts
import Phaser from "phaser";
import { AquariumBackground } from "./ui/AquariumBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { Sound } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { pickNearestWithinRadius } from "../core/pop";
import { pickReaction, netAdds, initialAquariumState, type AquariumState, type Reaction } from "../core/aquarium";

const BASELINE = 7;            // target ambient fish count
const HARD_CAP = 16;          // max concurrent fish
const SPAWN_INTERVAL = 0.8;   // seconds between ambient top-ups (while below baseline)
const TAP_RADIUS = 90;        // generous tap radius for small fingers
const ITEM_SCALE = 1.1 / 2;   // 144px emoji frames -> /2 keeps on-screen size ~79px
const DRIFT_MIN = 35, DRIFT_MAX = 80; // px/s horizontal drift
const NAP_TAPS = 5;           // taps on one fish (within the window) -> nap
const NAP_SECONDS = 2.5;
const TAP_WINDOW = 2.0;       // seconds; a fish's tap counter resets if idle longer
const NAP_SLOW = 0.3;         // drift multiplier while napping

// Curated sea-creature cast (emoji keys) — the 9 proven steady-looping aquatic
// creatures already in src/render/emoji.ts. (Noto's real fish/shark/dolphin/
// blowfish animations flicker/vanish mid-loop, so they are NOT used — see Task 1.)
const AQUARIUM_TYPES = [
  "whale", "turtle", "octopus", "crab", "lobster", "jellyfish", "penguin", "seal", "otter",
];

// Rainbow tint cycle (ROYGBIV) for color-flash + the shockwave overlay.
const RAINBOW_COLORS = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00a3ff, 0x5e5ce6, 0xaf52de];

type Fish = Phaser.GameObjects.Sprite;

export class AquariumScene extends Phaser.Scene {
  private bg!: AquariumBackground;
  private sound2!: Sound;
  private fx!: Celebrations;

  private fish!: Phaser.GameObjects.Group;
  private spawnTimer = 0;
  private _t = 0;
  private reduceMotion = false;
  private aqState: AquariumState = initialAquariumState();

  constructor() { super("Aquarium"); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.reduceMotion = (typeof window !== "undefined" && window.matchMedia)
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

    this.bg = new AquariumBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.fx = new Celebrations(this);

    this.fish = this.add.group();
    this.spawnTimer = 0;
    this._t = 0;
    this.aqState = initialAquariumState();

    // Dedicated looping music (quieter so SFX stay crisp). Robust autoplay
    // (immediate + delayed retry + unlock/first-tap), stopped on shutdown.
    const music = this.sound.add("aquarium", { loop: true, volume: 0.38 });
    const startMusic = () => { if (!music.isPlaying) music.play(); };
    startMusic();
    this.time.delayedCall(200, startMusic);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    this.input.once("pointerdown", startMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      music.stop();
      this.sound.stopAll();
      // Destroy any lingering 💤 labels.
      (this.fish.getChildren() as Fish[]).forEach((f) => {
        const z = f.getData("zzz") as Phaser.GameObjects.Text | null;
        if (z) z.destroy();
      });
    });

    // Multi-touch: up to 4 fingers; each taps the nearest fish.
    this.input.addPointer(3);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.tryTap(p.worldX, p.worldY));

    // Back to title (top-right) — no game-over otherwise.
    const back = this.add.text(W - 24, 24, "⬅", { fontSize: "44px" }).setOrigin(1, 0).setDepth(1000)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("Title"));

    // Start the tank already populated (fish spread across the screen).
    for (let i = 0; i < BASELINE; i++) {
      const x = 60 + Math.random() * (W - 120);
      const y = 150 + Math.random() * (H - 320);
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.spawnFishAt(x, y, dir, AQUARIUM_TYPES[Math.floor(Math.random() * AQUARIUM_TYPES.length)]);
    }
  }

  // Pool-friendly spawn used by ambient top-up, split, and school.
  private spawnFishAt(x: number, y: number, dir: number, type: string): Fish {
    let f = this.fish.getFirstDead(false) as Fish | null;
    if (!f) { f = spawnEmoji(this, x, y, type); this.fish.add(f); }
    else { this.tweens.killTweensOf(f); resetEmoji(f, type, x, y); }
    f.setScale(ITEM_SCALE).setAlpha(1).setAngle(0).clearTint().setActive(true).setVisible(true);
    f.setData("type", type);
    f.setData("dir", dir);
    f.setData("speedX", DRIFT_MIN + Math.random() * (DRIFT_MAX - DRIFT_MIN));
    f.setData("baseY", y);
    f.setData("bobAmp", 10 + Math.random() * 20);
    f.setData("bobFreq", 0.6 + Math.random() * 0.8);
    f.setData("bobPhase", Math.random() * Math.PI * 2);
    f.setData("taps", 0);
    f.setData("lastTapT", 0);
    f.setData("napUntil", 0);
    f.setData("zzz", null);
    return f;
  }

  // Short-lived rising "bubbles" as Arc GameObjects (no texture -> no Phaser-4
  // generateTexture gotcha). Halved under reduced-motion.
  private emitBubbles(x: number, y: number, count: number, spread: number) {
    const n = this.reduceMotion ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i++) {
      const bx = x + (Math.random() * 2 - 1) * spread;
      const r = 4 + Math.random() * 8;
      const b = this.add.circle(bx, y, r, 0xffffff, 0.5).setDepth(55);
      b.setStrokeStyle(2, 0xffffff, 0.8);
      this.tweens.add({
        targets: b, y: y - (70 + Math.random() * 80), alpha: 0,
        duration: 700 + Math.random() * 500, ease: "Sine.out", onComplete: () => b.destroy(),
      });
    }
  }

  private tryTap(px: number, py: number) {
    const actives = (this.fish.getChildren() as Fish[]).filter((f) => f.active);
    if (!actives.length) return;
    const idx = pickNearestWithinRadius(px, py, actives.map((f) => ({ x: f.x, y: f.y })), TAP_RADIUS);
    if (idx < 0) return;
    const fish = actives[idx];
    const now = this._t;

    // Napping fish only mumble — no big reaction.
    if ((fish.getData("napUntil") as number) > now) { this.sleepyMumble(fish); return; }

    // Per-fish frenzy accounting -> nap.
    let taps = fish.getData("taps") as number;
    const lastTapT = fish.getData("lastTapT") as number;
    if (now - lastTapT > TAP_WINDOW) taps = 0;
    taps += 1;
    fish.setData("taps", taps);
    fish.setData("lastTapT", now);
    if (taps >= NAP_TAPS) { this.startNap(fish, now); return; }

    // Pick + apply a surprise.
    const atCap = this.fish.countActive(true) >= HARD_CAP;
    const res = pickReaction(this.aqState, Math.random, { atCap });
    this.aqState = res.state;
    this.applyReaction(fish, res.reaction);
  }

  private applyReaction(fish: Fish, reaction: Reaction) {
    switch (reaction.id) {
      case "spin": this.rSpin(fish); break;
      case "wiggle": this.rWiggle(fish); break;
      case "bubble": this.rBubble(fish); break;
      case "squash": this.rSquash(fish); break;
      case "colorflash": this.rColorFlash(fish); break;
      case "heart": this.rHeart(fish); break;
      // Uncommon + Rare reactions are added in Tasks 6 & 7. Until then they fall
      // through to a gentle wiggle (always a pleasant, unbreakable response).
      default: this.rWiggle(fish); break;
    }
  }

  // --- Common reaction handlers ---
  private rSpin(fish: Fish) {
    this.tweens.add({ targets: fish, angle: fish.angle + 360, duration: 500, ease: "Cubic.out", onComplete: () => fish.setAngle(0) });
    this.sound.play("blub", { volume: 0.4, detune: Phaser.Math.Between(-100, 100) });
  }
  private rWiggle(fish: Fish) {
    const a = fish.angle;
    this.tweens.add({ targets: fish, angle: a + 14, yoyo: true, repeat: 3, duration: 70, onComplete: () => fish.setAngle(0) });
  }
  private rBubble(fish: Fish) {
    this.emitBubbles(fish.x, fish.y - 10, 6, 26);
    this.sound.play("blub", { volume: 0.5, detune: Phaser.Math.Between(-150, 150) });
  }
  private rSquash(fish: Fish) {
    this.tweens.add({
      targets: fish, scaleX: ITEM_SCALE * 1.3, scaleY: ITEM_SCALE * 0.7, yoyo: true,
      duration: 140, ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE),
    });
  }
  private rColorFlash(fish: Fish) {
    const cols = RAINBOW_COLORS;
    this.tweens.addCounter({
      from: 0, to: cols.length, duration: 600,
      onUpdate: (tw) => { if (fish.active) fish.setTint(cols[Math.floor(tw.getValue()) % cols.length]); },
      onComplete: () => { if (fish.active) fish.clearTint(); },
    });
  }
  private rHeart(fish: Fish) {
    const h = spawnEmoji(this, fish.x, fish.y, "heart").setScale(0.4).setDepth(60);
    this.tweens.add({ targets: h, y: h.y - 90, alpha: 0, duration: 700, ease: "Sine.out", onComplete: () => h.destroy() });
  }

  // --- Sleepy damper ---
  private sleepyMumble(fish: Fish) {
    this.tweens.add({ targets: fish, angle: fish.angle + 6, yoyo: true, duration: 120, repeat: 1 });
  }
  private startNap(fish: Fish, now: number) {
    fish.setData("napUntil", now + NAP_SECONDS);
    fish.setData("taps", 0);
    fish.setTint(0x99aabb);
    const zzz = this.add.text(fish.x, fish.y - 50, "💤", { fontSize: "40px" }).setOrigin(0.5).setDepth(60);
    fish.setData("zzz", zzz);
    this.tweens.add({ targets: fish, angle: 12, duration: 300 });
  }
  private wake(fish: Fish) {
    fish.setData("napUntil", 0);
    fish.clearTint();
    const z = fish.getData("zzz") as Phaser.GameObjects.Text | null;
    if (z) { z.destroy(); fish.setData("zzz", null); }
    this.tweens.killTweensOf(fish);
    fish.setAngle(0);
    this.tweens.add({ targets: fish, scale: ITEM_SCALE * 1.2, yoyo: true, duration: 160, onComplete: () => fish.setScale(ITEM_SCALE) });
    this.fx.popAt(fish.x, fish.y);
  }

  private recycle(fish: Fish) {
    this.tweens.killTweensOf(fish);
    const z = fish.getData("zzz") as Phaser.GameObjects.Text | null;
    if (z) { z.destroy(); fish.setData("zzz", null); }
    this.fish.killAndHide(fish);
    fish.setActive(false);
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this._t += dt;
    this.bg.update(dt, this.scale.width);
    const W = this.scale.width, H = this.scale.height;

    // Ambient top-up toward the baseline.
    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL) {
      this.spawnTimer = 0;
      const active = this.fish.countActive(true);
      if (active < BASELINE && active < HARD_CAP) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const x = dir > 0 ? -50 : W + 50;
        const y = 150 + Math.random() * (H - 320);
        this.spawnFishAt(x, y, dir, AQUARIUM_TYPES[Math.floor(Math.random() * AQUARIUM_TYPES.length)]);
      }
    }

    // Drift + bob; wake nappers; recycle off-screen fish.
    (this.fish.getChildren() as Fish[]).forEach((f) => {
      if (!f.active) return;
      const napping = (f.getData("napUntil") as number) > this._t;
      if (!napping && (f.getData("napUntil") as number) > 0) this.wake(f);

      const dir = f.getData("dir") as number;
      const speed = (f.getData("speedX") as number) * (napping ? NAP_SLOW : 1);
      f.x += dir * speed * dt;
      const baseY = f.getData("baseY") as number;
      f.y = baseY + Math.sin(this._t * (f.getData("bobFreq") as number) + (f.getData("bobPhase") as number)) * (f.getData("bobAmp") as number);

      // Move the 💤 with its fish.
      const z = f.getData("zzz") as Phaser.GameObjects.Text | null;
      if (z) z.setPosition(f.x, f.y - 50);

      if ((dir > 0 && f.x > W + 60) || (dir < 0 && f.x < -60)) this.recycle(f);
    });
  }
}
```

- [ ] **Step 2: Register the scene**

In `src/main.ts`: add the import after the `PeekabooScene` import —

```ts
import { AquariumScene } from "./scenes/AquariumScene";
```

— and add `AquariumScene` to the end of the `scene` array:

```ts
  scene: [BootScene, TitleScene, GameScene, CatchScene, PopScene, GumballScene, SoundboardScene, PeekabooScene, AquariumScene],
```

- [ ] **Step 3: Rename two modes + add the 7th title button (Tap the Aquarium)**

The current title uses a 2-column grid (`makeGridButton(x, y, w, h, emoji, label, color, onTap)`, `rowY = [590, 770, 950]`, 6 buttons incl. Peekaboo). In `src/scenes/TitleScene.ts` `create()`, first extend `rowY` with a 4th row:

```ts
    const rowY = [590, 770, 950, 1130];
```

Then replace the six `this.makeGridButton(...)` lines with these seven — renaming **Rainbow Shoot→Star Blaster** and **Rainbow Catch→Catch the Cuties** (scene keys `"Game"`/`"Catch"` unchanged), keeping Peekaboo, and adding **Tap the Aquarium** centered on the new 4th row:

```ts
    this.makeGridButton(colL, rowY[0], BW, BH, "⭐", "Star Blaster", 0x9b6bff, () => this.go("Game"));
    this.makeGridButton(colR, rowY[0], BW, BH, "🌈", "Catch the Cuties", 0x7ed957, () => this.go("Catch"));
    this.makeGridButton(colL, rowY[1], BW, BH, "🫧", "Pop the Cuties", 0xff5fa2, () => this.go("Pop"));
    this.makeGridButton(colR, rowY[1], BW, BH, "🎁", "Unicorn Gumballs", 0xff9f43, () => this.go("Gumball"));
    this.makeGridButton(colL, rowY[2], BW, BH, "🔊", "Animal Soundboard", 0x00b4d8, () => this.go("Soundboard"));
    this.makeGridButton(colR, rowY[2], BW, BH, "🐹", "Peekaboo", 0xffd23f, () => this.go("Peekaboo"));
    this.makeGridButton(W / 2, rowY[3], BW, BH, "🐠", "Tap the Aquarium", 0x0077b6, () => this.go("Aquarium"));
```

(The single new button is centered on row 4; with `BH = 150` its bottom edge is `1130 + 75 = 1205 < LOGICAL_HEIGHT` 1280, so it fits.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. (If `addCounter`'s `tw.getValue()` is typed `number | null` in the installed Phaser 4 typings, wrap with `Math.floor(tw.getValue() ?? 0)` — do not change behavior.)

- [ ] **Step 5: Build + full test suite**

Run: `npm run build` then `npm test`
Expected: build succeeds; tests unchanged from Task 2 (no scene tests).

- [ ] **Step 6: Runtime verification (Claude Preview)**

Start the dev server and open the game. Verify via `window.__game` evals and/or screenshots:
- The title now shows **seven** buttons (the 2-column grid plus a centered 7th on a new 4th row); the first two read **"⭐ Star Blaster"** and **"🌈 Catch the Cuties"**; Peekaboo is still present; the 7th is **"🐠 Tap the Aquarium"** (ocean-blue); all seven fit on screen without overlap.
- Tapping **Tap the Aquarium** starts the `Aquarium` scene over the new fish-tank background (blue water, sandy floor, swaying kelp, coral); music loops.
- ~7 sea-creatures drift sideways with a gentle bob and **keep animating**; fish that drift off an edge are replaced (the tank never empties).
- Tapping a fish triggers a visible reaction (spin / wiggle / bubble puff / squash / rainbow flash / floating heart). Uncommon/rare taps currently just wiggle (expected until Tasks 6–7).
- Mashing **one** fish ~5× makes it nap (💤, droop, desaturated, slows) for ~2.5 s, then it wakes (sparkle) and resumes; other fish are unaffected.
- Multi-touch: two fingers tap two different fish at once.
- The ⬅ button returns to the title; `preview_console_logs` shows no errors.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/AquariumScene.ts src/main.ts src/scenes/TitleScene.ts
git commit -m "feat(aquarium): AquariumScene core (drift, multitouch, common reactions, sleepy) + title wiring"
```

---

### Task 6: Uncommon reactions (split, bubble-stream, zoom, morph, backflip, giant)

**Files:**
- Modify: `src/scenes/AquariumScene.ts`

**Interfaces:**
- Consumes: `netAdds` + `AQUARIUM_TYPES` + `spawnFishAt`/`emitBubbles` (Task 5).
- Produces: handlers `rSplit`/`rBubbleStream`/`rZoom`/`rMorph`/`rBackflip`/`rGiant`, wired into `applyReaction`.

- [ ] **Step 1: Add the uncommon handlers**

In `src/scenes/AquariumScene.ts`, add these methods to the `AquariumScene` class (e.g. right after `rHeart`):

```ts
  // --- Uncommon reaction handlers ---
  // Split: the parent squashes and a same-species child pops out swimming the
  // other way. Cap-safe via netAdds (and pickReaction already filters split at cap).
  private rSplit(fish: Fish, reaction: Reaction) {
    this.rSquash(fish);
    const remaining = HARD_CAP - this.fish.countActive(true);
    if (netAdds(reaction, remaining) > 0) {
      const dir = -(fish.getData("dir") as number) || 1;
      const child = this.spawnFishAt(fish.x, fish.y, dir, fish.getData("type") as string);
      child.setScale(ITEM_SCALE * 0.6);
      this.tweens.add({ targets: child, scale: ITEM_SCALE, duration: 300, ease: "Back.out" });
      this.tweens.add({ targets: child, x: child.x + dir * 40, duration: 220, ease: "Sine.out" });
    }
    this.sound.play("sproing", { volume: 0.5 });
  }
  private rBubbleStream(fish: Fish) {
    this.time.addEvent({
      delay: 90, repeat: 7,
      callback: () => { if (fish.active) this.emitBubbles(fish.x, fish.y - 10, 2, 14); },
    });
    this.sound.play("blub", { volume: 0.45 });
  }
  private rZoom(fish: Fish) {
    const W = this.scale.width;
    const nx = 80 + Math.random() * (W - 160);
    this.emitBubbles(fish.x, fish.y, 5, 10);
    this.tweens.add({ targets: fish, x: nx, duration: 340, ease: "Cubic.inOut" });
    this.sound.play("blub", { volume: 0.4, detune: 200 });
  }
  private rMorph(fish: Fish) {
    const cur = fish.getData("type") as string;
    const others = AQUARIUM_TYPES.filter((t) => t !== cur);
    const nt = others[Math.floor(Math.random() * others.length)];
    this.emitBubbles(fish.x, fish.y, 8, 30);
    this.tweens.add({
      targets: fish, scale: ITEM_SCALE * 0.2, duration: 140, ease: "Sine.in",
      onComplete: () => {
        resetEmoji(fish, nt, fish.x, fish.y);
        fish.setData("type", nt);
        fish.setScale(ITEM_SCALE * 0.2);
        this.tweens.add({ targets: fish, scale: ITEM_SCALE, duration: 220, ease: "Back.out" });
      },
    });
    this.sound.play("blub", { volume: 0.4 });
  }
  private rBackflip(fish: Fish) {
    const a = fish.angle;
    this.tweens.add({ targets: fish, angle: a - 360, duration: 650, ease: "Back.inOut", onComplete: () => fish.setAngle(0) });
    this.tweens.add({ targets: fish, scaleX: ITEM_SCALE * 1.15, scaleY: ITEM_SCALE * 1.15, yoyo: true, duration: 325, onComplete: () => fish.setScale(ITEM_SCALE) });
  }
  private rGiant(fish: Fish) {
    this.tweens.add({
      targets: fish, scale: ITEM_SCALE * 2.4, yoyo: true, hold: 200, duration: 260,
      ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE),
    });
    this.sound.play("blub", { volume: 0.5, detune: -300 });
  }
```

- [ ] **Step 2: Wire them into `applyReaction`**

In `applyReaction`, add these cases before the `default:` line:

```ts
      case "split": this.rSplit(fish, reaction); break;
      case "bubblestream": this.rBubbleStream(fish); break;
      case "zoom": this.rZoom(fish); break;
      case "morph": this.rMorph(fish); break;
      case "backflip": this.rBackflip(fish); break;
      case "giant": this.rGiant(fish); break;
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass.

- [ ] **Step 4: Runtime verification (Claude Preview)**

In the Aquarium scene, tap fish repeatedly and confirm the uncommon reactions appear (they're ~30% of taps): **split** (a second fish pops out and swims off), **bubble-stream** (a rising column of bubbles), **zoom** (the fish dashes to a new spot), **morph** (puffs and becomes a different creature), **backflip** (a loop), **giant** (balloons then shrinks). Mash to the cap (~16 fish) and confirm **split stops adding** (the tank holds at the cap, no overflow) and nothing errors. `preview_console_logs` clean.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/AquariumScene.ts
git commit -m "feat(aquarium): uncommon reactions (split, bubble-stream, zoom, morph, backflip, giant)"
```

---

### Task 7: Rare jackpots (school, rainbow shockwave, treasure chest)

**Files:**
- Modify: `src/scenes/AquariumScene.ts`

**Interfaces:**
- Consumes: `netAdds` + `spawnFishAt` + `emitBubbles` + `fx`/`sound2` + `RAINBOW_COLORS` (Task 5).
- Produces: handlers `rSchool`/`rShockwave`/`rTreasure`, wired into `applyReaction`.

- [ ] **Step 1: Add the jackpot handlers**

In `src/scenes/AquariumScene.ts`, add these methods to the class (e.g. after `rGiant`):

```ts
  // --- Rare jackpot handlers ---
  // School: a few mixed friends swim in from an edge. Cap-safe via netAdds
  // (and pickReaction filters school out entirely when already at cap).
  private rSchool(_fish: Fish, reaction: Reaction) {
    const W = this.scale.width, H = this.scale.height;
    const remaining = HARD_CAP - this.fish.countActive(true);
    const adds = netAdds(reaction, remaining);
    for (let i = 0; i < adds; i++) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const x = dir > 0 ? -50 - i * 60 : W + 50 + i * 60;
      const y = 150 + Math.random() * (H - 320);
      const t = AQUARIUM_TYPES[Math.floor(Math.random() * AQUARIUM_TYPES.length)];
      const f = this.spawnFishAt(x, y, dir, t);
      f.setScale(ITEM_SCALE * 0.4);
      this.tweens.add({ targets: f, scale: ITEM_SCALE, duration: 300, ease: "Back.out" });
    }
    this.fx.banner("🐟", "#0077b6");
    this.sound2.fanfare();
  }
  // Rainbow shockwave: a slow low-contrast rainbow overlay (NOT a strobe) +
  // every fish reacts in a staggered wave. Reduced-motion -> a single soft pulse.
  private rShockwave(_fish: Fish) {
    const W = this.scale.width, H = this.scale.height;
    const cols = RAINBOW_COLORS;
    const dur = this.reduceMotion ? 600 : 1100;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, cols[0], 1).setDepth(40).setAlpha(0);
    this.tweens.addCounter({
      from: 0, to: cols.length, duration: dur,
      onUpdate: (tw) => { overlay.fillColor = cols[Math.floor(tw.getValue()) % cols.length]; },
    });
    this.tweens.add({
      targets: overlay, alpha: this.reduceMotion ? 0.12 : 0.22, yoyo: true, hold: 200,
      duration: this.reduceMotion ? 300 : 550, ease: "Sine.inOut", onComplete: () => overlay.destroy(),
    });
    const actives = (this.fish.getChildren() as Fish[]).filter((f) => f.active && (f.getData("napUntil") as number) <= this._t);
    actives.forEach((f, i) => {
      this.time.delayedCall(this.reduceMotion ? 0 : i * 70, () => { if (f.active) this.rWiggle(f); });
    });
    this.fx.banner("🌈");
    this.sound2.tada();
  }
  // Treasure chest: a shape-based chest rises from the floor, pops open into a
  // gem/sparkle/bubble fountain + fanfare, then sinks. Non-additive (the tapped
  // fish keeps drifting), so always cap-safe.
  private rTreasure(fish: Fish) {
    const H = this.scale.height;
    const floorY = H - 70;
    const cx = fish.x;

    const chest = this.add.container(cx, floorY + 90).setDepth(45);
    const body = this.add.graphics();
    body.fillStyle(0x8a5a2b, 1).fillRoundedRect(-50, -28, 100, 52, 8);
    body.fillStyle(0xffd54a, 1).fillRect(-50, -4, 100, 8);
    const lid = this.add.graphics();
    lid.fillStyle(0x6e4420, 1).fillRoundedRect(-50, -46, 100, 22, 8);
    chest.add([body, lid]);

    this.tweens.add({
      targets: chest, y: floorY, duration: 360, ease: "Back.out",
      onComplete: () => {
        this.tweens.add({ targets: lid, y: -64, angle: -12, duration: 240, ease: "Sine.out" });
        this.emitBubbles(cx, floorY - 20, 16, 40);
        this.fx.popAt(cx, floorY - 20);
        for (let i = 0; i < 5; i++) {
          const gem = spawnEmoji(this, cx + (Math.random() * 2 - 1) * 40, floorY - 20, "gem").setScale(0.35).setDepth(46);
          this.tweens.add({
            targets: gem, y: gem.y - (120 + Math.random() * 100), x: gem.x + (Math.random() * 2 - 1) * 50,
            alpha: 0, duration: 1000 + Math.random() * 400, ease: "Sine.out", onComplete: () => gem.destroy(),
          });
        }
        this.fx.banner("💎", "#ffd54a");
        this.sound2.fanfare();
        this.sound.play("chime", { volume: 0.6 });
        this.time.delayedCall(1600, () => {
          this.tweens.add({ targets: chest, y: floorY + 90, alpha: 0, duration: 400, onComplete: () => chest.destroy() });
        });
      },
    });
  }
```

- [ ] **Step 2: Wire them into `applyReaction`**

In `applyReaction`, add these cases before the `default:` line:

```ts
      case "school": this.rSchool(fish, reaction); break;
      case "shockwave": this.rShockwave(fish); break;
      case "treasure": this.rTreasure(fish); break;
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass. (`rSchool`/`rShockwave` take a leading `_fish` param to match the `applyReaction` call shape; the underscore satisfies `noUnusedParameters`.)

- [ ] **Step 4: Runtime verification (Claude Preview)**

Jackpots are rare (~5%, pity-bounded), so force them for verification by temporarily lowering the pity ceiling OR tapping persistently. Confirm each: **school** (a few friends swim in, fanfare; if near the cap, fewer/none spawn and nothing errors), **shockwave** (a slow rainbow tint sweep with every fish wiggling in a staggered wave — no harsh flashing), **treasure** (a chest rises from the sand, opens into a gem/bubble fountain with fanfare + chime, then sinks; the tapped fish keeps swimming). Toggle OS "Reduce Motion" and confirm the shockwave becomes a single soft pulse and bubble counts halve. `preview_console_logs` clean. Then run `npm test` + `npx tsc --noEmit` + `npm run build` once more — all green.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/AquariumScene.ts
git commit -m "feat(aquarium): rare jackpots (school, rainbow shockwave, treasure chest)"
```

---

## Self-Review

**1. Spec coverage** (against `docs/superpowers/specs/2026-06-27-tap-the-aquarium-design.md`):
- §1 identity / non-destructive / no HUD → Task 5 (no score/HUD, only ⬅ back). ✅
- §3.1 flowing tank (baseline/cap/recycle) → Task 5 (`BASELINE`/`HARD_CAP`/ambient top-up/`recycle`). ✅
- §3.2 multi-touch + generous radius → Task 5 (`addPointer(3)`, `pickNearestWithinRadius`, `TAP_RADIUS`). ✅
- §3.3 catalog (6/6/3) → Task 2 `REACTIONS`; handlers across Tasks 5–7. ✅
- §3.4 selection engine (cap-filter, pity/min-gap, no-repeat) → Task 2 `pickReaction` + tests. ✅
- §3.5 `netAdds` → Task 2 + used in `rSplit`/`rSchool`. ✅
- §3.6 sleepy damper (per-fish, ~5 taps, ~2.5 s, 💤) → Task 5 (`startNap`/`wake`/`sleepyMumble`). ✅
- §3.7 jackpots (school cap-aware, slow shockwave, shape-chest treasure) → Task 7. ✅
- §4 cast → the 9 existing aquatic creatures (whale/turtle/octopus/crab/lobster/jellyfish/penguin/seal/otter); real-fish additions dropped after failing the loop-safety probe (see Task 1) → `AQUARIUM_TYPES` (Task 5). ✅
- §5 `AquariumBackground` (blue water/sand/kelp/coral) → Task 3. ✅
- §6 own music + reaction SFX (blub/sproing/chime) → Task 4; used in handlers. ✅
- §7 architecture (pure core + scene + bg; lifecycle discipline `killTweensOf` before recycle) → Tasks 2/3/5 (`recycle`/`spawnFishAt` kill tweens; SHUTDOWN stops music + destroys 💤). ✅
- §8 Phaser-4 specifics (no `setTintFill`; no Timeline → `delayedCall`/tweens; shape bubbles not `generateTexture`) → Tasks 3/5/7. ✅
- §9 testing (pity/min-gap/cap/no-repeat/distribution/netAdds + runtime) → Task 2 tests + Tasks 5–7 runtime. ✅
- §10 title (6th button + 2 renames + re-space) → Task 5 Step 3. ✅
- §11 non-goals (no score/deps/other-mode changes) → honored throughout (only additive emoji + the TitleScene button list change). ✅

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. The `default: wiggle` in Task 5 is an intentional, documented safety fallback (not a placeholder) that Tasks 6–7 supersede with real handlers. ✅

**3. Type consistency:** `pickReaction`/`netAdds`/`initialAquariumState`/`AquariumState`/`Reaction` signatures match between Task 2 and Tasks 5–7; `pickNearestWithinRadius` matches `pop.ts`; `spawnEmoji`/`resetEmoji`, `Sound.fanfare()/tada()`, `Celebrations.popAt()/banner()/bigParty()`, `AquariumBackground(scene,w,h)/update(dt,w)` all match the real modules; handler names referenced in `applyReaction` (`rSpin`/`rWiggle`/`rBubble`/`rSquash`/`rColorFlash`/`rHeart`/`rSplit`/`rBubbleStream`/`rZoom`/`rMorph`/`rBackflip`/`rGiant`/`rSchool`/`rShockwave`/`rTreasure`) are each defined in Tasks 5/6/7. ✅

No gaps found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-27-tap-the-aquarium.md`.

> **Branch / concurrency note:** This plan targets the **`aquarium`** branch, **rebased onto the latest `master`** which already includes the merged **Peekaboo** mode (6 modes, 2-column grid title). Tap the Aquarium is the **7th** mode. Implementation runs in an isolated worktree (`C:/Code/unicorn-galaga-2-aquarium`). A separate **Surprise Eggs** mode is still in progress in its own worktree; it may also touch `TitleScene`/`main.ts`, so whichever lands second will need a small reconciliation (keep all buttons + scene registrations).
