import Phaser from "phaser";

// The four nest positions (centres), spread across the grass below the barn.
// Shared with EggsScene so each egg sits in its own nest. Responsive to W/H.
export function nestSlots(W: number, H: number): { x: number; y: number }[] {
  const colL = W * 0.26, colR = W * 0.74;
  const rowT = H * 0.66, rowB = H * 0.90;
  return [
    { x: colL, y: rowT }, { x: colR, y: rowT },
    { x: colL, y: rowB }, { x: colR, y: rowB },
    { x: W / 2, y: H * 0.78 }, // 5th egg, nestled in the middle of the other four
  ];
}

// A soft white cloud (three overlapping lumps).
function cloud(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number) {
  g.fillStyle(0xffffff, 0.92);
  g.fillEllipse(cx, cy, 120 * s, 52 * s);
  g.fillEllipse(cx - 46 * s, cy + 8 * s, 78 * s, 40 * s);
  g.fillEllipse(cx + 52 * s, cy + 10 * s, 88 * s, 38 * s);
}

// A small woven straw nest: a shadowed mound with a recessed hollow, ringed by
// short tangential straw strokes in layered gold/tan shades (reads as woven, not
// a flat disc). One egg sits in each (drawn by the scene, in front).
function drawNest(g: Phaser.GameObjects.Graphics, nx: number, ny: number, rx: number, ry: number) {
  // Soft ground shadow.
  g.fillStyle(0x33602a, 0.26); g.fillEllipse(nx, ny + ry * 0.5, rx * 1.92, ry * 0.72);

  // Straw mound (outer → inner shades) building a bowl.
  g.fillStyle(0xa9803a, 1); g.fillEllipse(nx, ny + ry * 0.08, rx * 2.0, ry * 2.0);
  g.fillStyle(0xc6a052, 1); g.fillEllipse(nx, ny, rx * 1.86, ry * 1.72);

  // Recessed hollow (a cozy, lightly-shadowed straw bed — not a dark void).
  g.fillStyle(0x9c7838, 1); g.fillEllipse(nx, ny - ry * 0.04, rx * 1.18, ry * 1.08);
  g.fillStyle(0x82632e, 1); g.fillEllipse(nx, ny - ry * 0.04, rx * 0.82, ry * 0.74);

  // Woven straws: layered rings of short tangential strokes.
  const shades = [0xefd596, 0xd8b566, 0xbe974a, 0xa37e38];
  const len = Math.max(12, rx * 0.22);
  for (let layer = 0; layer < 3; layer++) {
    const rr = 0.82 + layer * 0.09;
    const n = Math.round(rx * 0.42);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + layer * 0.4;
      const px = nx + Math.cos(a) * rx * rr;
      const py = ny + Math.sin(a) * ry * rr;
      let tx = -rx * Math.sin(a), ty = ry * Math.cos(a);
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      g.lineStyle(3, shades[(i + layer) % shades.length], 0.95);
      g.beginPath();
      g.moveTo(px - tx * len * 0.5, py - ty * len * 0.5);
      g.lineTo(px + tx * len * 0.5, py + ty * len * 0.5);
      g.strokePath();
    }
  }
}

// Static, shape-drawn barnyard: sky + sun + clouds, rolling grass with tufts, a
// red barn + white fence, and four small straw nests (one per egg). No image
// assets, no animation (the eggs stay the stars).
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
      [W * 0.1, H * 0.78], [W * 0.9, H * 0.76], [W * 0.5, H * 0.73],
      [W * 0.5, H * 0.96], [W * 0.14, H * 0.95], [W * 0.86, H * 0.96],
    ];
    for (const [tx, ty] of tufts) {
      for (const d of [-7, 0, 7]) {
        g.beginPath(); g.moveTo(tx + d, ty); g.lineTo(tx + d * 1.7, ty - 17); g.strokePath();
      }
    }

    // Four small straw nests, one per egg.
    const nrx = Math.min(W * 0.15, 84), nry = 36;
    for (const s of nestSlots(W, H)) drawNest(g, s.x, s.y, nrx, nry);
  }

  // Static background — no per-frame work; method kept for signature parity.
  update(_dt: number, _W: number): void {}
}
