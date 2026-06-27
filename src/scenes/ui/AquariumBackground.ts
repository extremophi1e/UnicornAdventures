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
