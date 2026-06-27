import Phaser from "phaser";

// Static meadow + sky for the Tap-to-Grow Garden. The sun rotates and clouds
// drift; `setWarmth(t)` eases the sky toward golden-hour as the meadow fills.
export class GardenBackground extends Phaser.GameObjects.Container {
  private sky: Phaser.GameObjects.Graphics;
  private hills: Phaser.GameObjects.Graphics;
  private sun: Phaser.GameObjects.Container;
  private clouds: Phaser.GameObjects.Ellipse[] = [];
  private _w = 0;
  private warmth = 0;
  readonly horizon: number;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(-10);
    this.horizon = height * 0.55;
    this._w = width;

    this.sky = scene.add.graphics();
    this.add(this.sky);

    for (let i = 0; i < 3; i++) {
      const c = scene.add.ellipse(Math.random() * width, 90 + i * 70, 150, 60, 0xffffff, 0.9);
      this.clouds.push(c); this.add(c);
    }

    this.sun = scene.add.container(width - 185, 200);
    const rays = scene.add.graphics();
    rays.lineStyle(6, 0xffe27a, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      rays.beginPath();
      rays.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
      rays.lineTo(Math.cos(a) * 52, Math.sin(a) * 52);
      rays.strokePath();
    }
    this.sun.add(rays);
    this.sun.add(scene.add.circle(0, 0, 30, 0xffe27a));
    this.add(this.sun);
    this.sun.setScale(3); // 3x larger (repositioned above to stay clear of the top/right edges)

    this.hills = scene.add.graphics();
    this.add(this.hills);

    this.redraw(width, height);
  }

  // Lerp two ints by t (0..1).
  private mix(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }

  private redraw(width: number, height: number): void {
    const skyTop = this.mix(0xbfeaff, 0xffe1b0, this.warmth);   // blue -> warm
    this.sky.clear();
    this.sky.fillStyle(skyTop, 1).fillRect(0, 0, width, height);

    this.hills.clear();
    this.hills.fillStyle(0x8fd267, 1);
    this.hills.fillCircle(width * 0.25, this.horizon + 50, 150);
    this.hills.fillCircle(width * 0.72, this.horizon + 40, 180);
    this.hills.fillStyle(0x6cc24a, 1);
    this.hills.fillRect(0, this.horizon, width, height - this.horizon);
  }

  setWarmth(t: number): void {
    const c = Math.max(0, Math.min(1, t));
    if (Math.abs(c - this.warmth) < 0.001) return;
    this.warmth = c;
    this.redraw(this._w, this.scene.scale.height);
  }

  update(dt: number): void {
    this.sun.rotation += dt * 0.2;
    for (const c of this.clouds) {
      c.x += dt * 10;
      if (c.x - c.width > this._w) c.x = -c.width;
    }
  }
}
