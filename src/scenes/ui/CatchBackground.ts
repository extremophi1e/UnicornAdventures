import Phaser from "phaser";

// Shape-based animated "parallax meadow" for Rainbow Catch. Distinct in style
// from the shooter's gradient sky. Motion sits low/peripheral so it doesn't
// compete with the falling items.
export class CatchBackground extends Phaser.GameObjects.Container {
  private sky: Phaser.GameObjects.Graphics;
  private hills: Phaser.GameObjects.Graphics;
  private sun: Phaser.GameObjects.Container;
  private clouds: Phaser.GameObjects.Ellipse[] = [];
  private ground: Phaser.GameObjects.Container;
  private _w = 0;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(-10);

    this.sky = scene.add.graphics();
    this.add(this.sky);

    // Sun: a disc plus radiating spokes; the whole container rotates.
    this.sun = scene.add.container(0, 0);
    this.add(this.sun);
    const rays = scene.add.graphics();
    rays.lineStyle(6, 0xffd23f, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      rays.beginPath();
      rays.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
      rays.lineTo(Math.cos(a) * 50, Math.sin(a) * 50);
      rays.strokePath();
    }
    const disc = scene.add.circle(0, 0, 28, 0xffd23f);
    this.sun.add(rays);
    this.sun.add(disc);

    for (let i = 0; i < 3; i++) {
      const c = scene.add.ellipse(0, 0, 150, 70, 0xffffff, 0.92);
      this.clouds.push(c);
      this.add(c);
    }

    this.hills = scene.add.graphics();
    this.add(this.hills);

    this.ground = scene.add.container(0, 0);
    this.add(this.ground);

    this.resize(width, height);
  }

  private buildGround(width: number, height: number): void {
    this.ground.removeAll(true);
    const baseY = height - 40;
    const colors = [0xff6fa5, 0xffd23f, 0x9b6bff, 0x5bc0ff, 0xff8fcf];
    const step = 90;
    // Two side-by-side copies so the strip can scroll seamlessly by `width`.
    for (let copy = 0; copy < 2; copy++) {
      let k = 0;
      for (let x = 30; x < width; x += step, k++) {
        const fx = x + copy * width;
        this.ground.add(this.scene.add.rectangle(fx, baseY, 4, 22, 0x2f7d2a));
        this.ground.add(this.scene.add.circle(fx, baseY - 16, 9, colors[k % colors.length]));
      }
    }
  }

  resize(width: number, height: number): void {
    this._w = width;

    this.sky.clear();
    this.sky.fillStyle(0xa9e2ff, 1).fillRect(0, 0, width, height);

    const horizon = height - 90;
    this.hills.clear();
    this.hills.fillStyle(0x8fd267, 1);
    this.hills.fillCircle(width * 0.25, horizon + 40, 140);
    this.hills.fillCircle(width * 0.7, horizon + 30, 170);
    this.hills.fillStyle(0x5fb94a, 1);
    this.hills.fillRect(0, horizon, width, height - horizon);

    // Sun (3x size) on the right, clear of the top-left score and top-right back button.
    this.sun.setScale(3);
    this.sun.setPosition(width - 180, 230);
    this.clouds.forEach((c, i) => c.setPosition((width / 4) * (i + 1), 150 + (i % 2) * 70));

    this.buildGround(width, height);
  }

  update(dt: number): void {
    this.sun.rotation += dt * 0.25;
    for (const c of this.clouds) {
      c.x += 14 * dt;
      if (c.x > this._w + 90) c.x = -90;
    }
    this.ground.x -= 70 * dt;
    if (this.ground.x <= -this._w) this.ground.x += this._w;
  }
}
