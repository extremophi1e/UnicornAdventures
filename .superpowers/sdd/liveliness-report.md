# Liveliness Feature Report

## Item 1: Gem Atlas Frame

- `scripts/build-atlas.mjs`: Added `{ name: "gem", code: "1F48E" }` as the 13th entry in `FRAMES`. Also added a 13th placeholder colour `[180, 220, 255]` to the `PLACEHOLDER_COLORS` array so the placeholder logic doesn't wrap on index out-of-bounds. The atlas now composes a 432×216 sprite sheet (3 rows × 6 columns). `npm run atlas` successfully downloaded all 13 frames from OpenMoji, including 💎.
- `src/render/sprites.ts`: Added `heart: "heart"` and `gem: "gem"` to `SPRITE_FRAME`. (`heart` was already referenced in the codebase by string key but missing from this map.)
- **Confirmed:** `public/atlas/openmoji.json` contains `"gem": { "frame": { "x": 72, "y": 144, ... } }` at line 243.

## Item 2: Score (top-left)

- `protected score = 0` field added to `GameScene`.
- `create()` resets `this.score = 0` and creates `this.scoreText` via `this.add.text(24, 24, "⭐ 0", { fontSize:"44px", color:"#ffffff", fontStyle:"bold", stroke:"#7a3fa0", strokeThickness:6 })` at depth 1000.
- `protected addScore(n: number)` increments `this.score` and calls `this.scoreText.setText(...)`.
- Score awards: **+10** per enemy popped (in `updateEnemies` hit loop), **+5** per boss hit (in `updateBoss` star-hit loop), **+25** per collectible collected (in `updateCollectibles`).
- `RainbowScene` inherits `update` → inherits score display automatically.

## Item 3: Falling Collectibles

- `protected collectibles!: Phaser.GameObjects.Group` created in `create()`.
- `private collectibleTimer = 0` and `private nextCollectibleIn` (base 2.5 s + ±0.4 s jitter) drive spawn timing.
- `spawnCollectible()` picks `"gem"` or `"heart"` at 50/50, chooses random x in play bounds (80…width-80), reuses dead pool objects or creates new ones. Glow is added once on first creation (guarded by `"glowed"` data flag).
- `updateCollectibles(dt)` advances each active collectible downward at 240 px/s, spins it (rotation accumulates in a `"rot"` data key). Distance check radius 70 vs. unicorn → collect (+25 score, popAt, pop sfx, killAndHide). Off-bottom → killAndHide silently.
- Both `spawnCollectible` and `updateCollectibles` are private methods called from `update()`, so `RainbowScene` inherits collectibles automatically.

## Item 4: Subtle Glow

- `addGlowOnce(obj, color, outerStrength)` utility function at top of `GameScene.ts`.
- Guards: checks `obj.getData("glowed")` before applying; accesses `preFX` via `(obj as unknown as Record<string, any>)["preFX"]` with a function type-check — returns silently on Canvas renderer where `preFX` is absent or lacks `addGlow`.
- Applied to:
  - **Unicorn body image** (`body`) in `create()` — colour `0xffffff`, strength 3.
  - **Enemies** in `spawnFormation()` on first creation only — colour `0xffeedd`, strength 4. On pool reuse the `"glowed"` flag is already set so no stacking.
  - **Collectibles** in `spawnCollectible()` on first creation only — colour `0xffd700`, strength 3.
- Stars are NOT glowed (performance).
- `preFX` is not in Phaser 4 TypeScript stubs; the `any`-cast was necessary to compile under `strict: true`.

## Item 5: Alive Feel — Eased Pulse + Rotation

- **Enemies:** `updateEnemies` applies per-frame sine: `breathe = Math.sin(this.t * 1.8 + phase)` where `phase` is set via `img.setData("phase", Math.random() * Math.PI * 2)` at spawn (both on first creation and on pool reuse so each wave gets fresh randomness). Scale = `1.1 + breathe * 0.055` (±5% around base 1.1); angle = `breathe * 5` (±5°). The existing x-sway is preserved unchanged.
- **Unicorn container:** A Phaser tween is added in `create()` with `scaleX: 1.06, scaleY: 1.06, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, ease: "Sine.easeInOut", duration: 900`. The container itself is tweened (containers support tweens but not preFX — correct choice).
- **Boss:** Untouched. Existing movement tween left as-is.

## Build / Test Results

- `npm run atlas`: All 13 frames downloaded and composited successfully. 432×216 PNG output.
- `npm run build`: `tsc --noEmit` passes with 0 errors; `vite build` succeeds in 4.5 s.
- `npm test`: 51/51 tests pass (12 test files). No regressions.

## Unverifiable Without a Browser

- Visual confirmation of glow rendering (WebGL only) — logic is correct and guarded, but glow appearance requires a live browser.
- Collectible spin and scale-pulse smoothness — logic correct, visual feel unverified.
- Score text legibility at different screen sizes — chosen 44 px bold with purple stroke, should be readable.
- Sound on collectible collect uses `this.sound2.pop()` — same as enemy pop; no separate "collect" sound exists so this is the best available option.
- Canvas renderer fallback for preFX — `addGlowOnce` will simply skip glow silently; no crash.

## Concerns

- `preFX` requires WebGL. The `any`-cast is the only way to call it under current Phaser 4 type stubs. When Phaser 4 types are updated to include `preFX`, this cast can be removed.
- The `scoreText` uses the emoji character ⭐ — renders fine on all modern OS/browser combinations but is font-dependent.
- `heart` was added to `SPRITE_FRAME` even though `CUTE_TYPES` (spread at the bottom of the record) may already include it. The explicit entry takes precedence (last-write wins with `...fromEntries`) or is a harmless duplicate if `heart` is not in `CUTE_TYPES`.
