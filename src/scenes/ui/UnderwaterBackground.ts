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
