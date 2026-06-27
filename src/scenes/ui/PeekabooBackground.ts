import Phaser from "phaser";

// Static meadow + sky for Peekaboo. Unlike CatchBackground it does NOT scroll, so the
// fixed hiding spots stay put. Only the sun rotates gently.
export class PeekabooBackground extends Phaser.GameObjects.Container {
  private sky: Phaser.GameObjects.Graphics;
  private hills: Phaser.GameObjects.Graphics;
  private sun: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(-10);

    this.sky = scene.add.graphics();
    this.add(this.sky);

    this.sun = scene.add.container(0, 0);
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
    this.add(this.sun);

    this.hills = scene.add.graphics();
    this.add(this.hills);

    this.resize(width, height);
  }

  private resize(width: number, height: number): void {
    this.sky.clear();
    this.sky.fillStyle(0xa9e2ff, 1).fillRect(0, 0, width, height);

    const horizon = height * 0.6;
    this.hills.clear();
    this.hills.fillStyle(0x8fd267, 1);
    this.hills.fillCircle(width * 0.25, horizon + 50, 150);
    this.hills.fillCircle(width * 0.72, horizon + 40, 180);
    this.hills.fillStyle(0x5fb94a, 1);
    this.hills.fillRect(0, horizon, width, height - horizon);

    this.sun.setScale(2.4).setPosition(width - 150, 150);
  }

  update(dt: number): void {
    this.sun.rotation += dt * 0.25;
  }
}
