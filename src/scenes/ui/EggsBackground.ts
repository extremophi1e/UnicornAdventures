import Phaser from "phaser";

// Centre of the straw nest, shared with EggsScene (which nestles its 4 eggs here).
export const NEST_CX = (W: number) => W / 2;
export const NEST_CY = (H: number) => H * 0.66;

// A soft white cloud (three overlapping lumps).
function cloud(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number) {
  g.fillStyle(0xffffff, 0.92);
  g.fillEllipse(cx, cy, 120 * s, 52 * s);
  g.fillEllipse(cx - 46 * s, cy + 8 * s, 78 * s, 40 * s);
  g.fillEllipse(cx + 52 * s, cy + 10 * s, 88 * s, 38 * s);
}

// A woven straw nest: a shadowed mound with a recessed hollow, ringed by many
// short tangential straw strokes in layered gold/tan shades (reads as woven,
// not a flat disc). Eggs sit in the hollow (drawn by the scene, in front).
function drawNest(g: Phaser.GameObjects.Graphics, nx: number, ny: number, W: number) {
  const RX = Math.min(W * 0.34, 216), RY = 86;

  // Soft ground shadow.
  g.fillStyle(0x33602a, 0.28); g.fillEllipse(nx, ny + RY * 0.55, RX * 1.94, RY * 0.8);

  // Straw mound (outer → inner shades) building a bowl.
  g.fillStyle(0xa9803a, 1); g.fillEllipse(nx, ny + 6, RX * 2.0, RY * 2.02);
  g.fillStyle(0xc6a052, 1); g.fillEllipse(nx, ny, RX * 1.88, RY * 1.74);

  // Recessed hollow (a cozy, lightly-shadowed straw bed — not a dark void).
  g.fillStyle(0x9c7838, 1); g.fillEllipse(nx, ny - 2, RX * 1.2, RY * 1.12);
  g.fillStyle(0x82632e, 1); g.fillEllipse(nx, ny - 2, RX * 0.86, RY * 0.78);

  // Woven straws: layered rings of short tangential strokes.
  const shades = [0xefd596, 0xd8b566, 0xbe974a, 0xa37e38];
  for (let layer = 0; layer < 4; layer++) {
    const rr = 0.80 + layer * 0.085;
    const n = 48;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + layer * 0.4;
      const px = nx + Math.cos(a) * RX * rr;
      const py = ny + Math.sin(a) * RY * rr;
      // Unit tangent to the ellipse at angle a.
      let tx = -RX * Math.sin(a), ty = RY * Math.cos(a);
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const len = 22 + (i % 3) * 5;
      g.lineStyle(4, shades[(i + layer) % shades.length], 0.95);
      g.beginPath();
      g.moveTo(px - tx * len * 0.5, py - ty * len * 0.5);
      g.lineTo(px + tx * len * 0.5, py + ty * len * 0.5);
      g.strokePath();
    }
  }
}

// Static, shape-drawn barnyard: sky + sun + clouds, rolling grass with tufts, a
// red barn + white fence, and a woven straw nest. No image assets, no animation
// (the eggs stay the stars). Nest centre = (NEST_CX(W), NEST_CY(H)).
export class EggsBackground {
  constructor(scene: Phaser.Scene, W: number, H: number) {
    const g = scene.add.graphics().setDepth(-10);
    const horizon = H * 0.6;

    // Sky.
    g.fillGradientStyle(0x8ec9ff, 0x8ec9ff, 0xdaf1ff, 0xdaf1ff, 1);
    g.fillRect(0, 0, W, horizon + 30);

    // Sun (soft halo, no strobe).
    g.fillStyle(0xfff8d6, 0.5); g.fillCircle(W * 0.82, H * 0.14, 92);
    g.fillStyle(0xfff3b0, 1); g.fillCircle(W * 0.82, H * 0.14, 66);

    // Clouds.
    cloud(g, W * 0.24, H * 0.12, 1.0);
    cloud(g, W * 0.6, H * 0.26, 0.66);

    // Grass.
    g.fillGradientStyle(0x9ed77c, 0x9ed77c, 0x6fb24e, 0x6fb24e, 1);
    g.fillRect(0, horizon - 20, W, H - horizon + 20);

    // Barn (body, roof, gold trim, door, window).
    const bx = W * 0.2, by = horizon, bw = Math.min(W * 0.26, 185), bh = 150;
    g.fillStyle(0xc0392b, 1); g.fillRect(bx - bw / 2, by - bh, bw, bh);
    g.fillStyle(0x8e2a20, 1);
    g.fillTriangle(bx - bw / 2 - 12, by - bh, bx + bw / 2 + 12, by - bh, bx, by - bh - 54);
    g.fillStyle(0xf2c14e, 1); g.fillRect(bx - bw / 2, by - bh - 3, bw, 6);
    g.fillStyle(0x6b1f18, 1); g.fillRect(bx - 22, by - 64, 44, 64);
    g.fillStyle(0xfbe9c0, 1); g.fillRect(bx + bw * 0.16, by - bh + 26, 30, 30);
    g.lineStyle(4, 0x6b1f18, 1);
    g.beginPath(); g.moveTo(bx + bw * 0.16 + 15, by - bh + 26); g.lineTo(bx + bw * 0.16 + 15, by - bh + 56); g.strokePath();
    g.beginPath(); g.moveTo(bx + bw * 0.16, by - bh + 41); g.lineTo(bx + bw * 0.16 + 30, by - bh + 41); g.strokePath();

    // White picket fence (right of the barn).
    g.fillStyle(0xffffff, 1);
    g.fillRect(W * 0.46, by - 22, W * 0.54, 7);
    for (let fx = W * 0.47; fx < W - 12; fx += 44) g.fillRect(fx, by - 36, 9, 48);

    // Scattered grass tufts.
    g.lineStyle(3, 0x5fa244, 1);
    const tufts: [number, number][] = [
      [W * 0.1, H * 0.74], [W * 0.88, H * 0.7], [W * 0.32, H * 0.86],
      [W * 0.68, H * 0.88], [W * 0.5, H * 0.93], [W * 0.16, H * 0.9],
    ];
    for (const [tx, ty] of tufts) {
      for (const d of [-7, 0, 7]) {
        g.beginPath(); g.moveTo(tx + d, ty); g.lineTo(tx + d * 1.7, ty - 17); g.strokePath();
      }
    }

    // Straw nest.
    drawNest(g, NEST_CX(W), NEST_CY(H), W);
  }

  // Static background — no per-frame work; method kept for signature parity.
  update(_dt: number, _W: number): void {}
}
