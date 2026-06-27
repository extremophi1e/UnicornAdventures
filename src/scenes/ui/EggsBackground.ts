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
