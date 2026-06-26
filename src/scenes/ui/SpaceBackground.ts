import Phaser from "phaser";

// Shape-based deep-space background for the shooter: a dark star field with
// twinkling stars, so the bright unicorn, rainbow stars, and enemies pop.
// (The old rainbow-sky Background.ts is kept for reuse in a future game type.)
export class SpaceBackground extends Phaser.GameObjects.Container {
  private sky: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Arc[] = [];
  private starPhase: number[] = [];
  private _t = 0;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(-10);

    this.sky = scene.add.graphics();
    this.add(this.sky);

    for (let i = 0; i < 90; i++) {
      const s = scene.add.circle(0, 0, 1 + Math.random() * 2, 0xffffff, 1);
      this.stars.push(s);
      this.starPhase.push(Math.random() * Math.PI * 2);
      this.add(s);
    }

    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this.sky.clear();
    const bands = [0x0a0a2a, 0x100f3a, 0x1a0f3a, 0x250b34];
    const bandH = height / bands.length;
    bands.forEach((c, i) => this.sky.fillStyle(c, 1).fillRect(0, i * bandH, width, bandH + 1));

    for (const s of this.stars) s.setPosition(Math.random() * width, Math.random() * height);
  }

  update(dt: number, _width: number): void {
    this._t += dt;
    for (let i = 0; i < this.stars.length; i++) {
      this.stars[i].setAlpha(0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this._t * 3 + this.starPhase[i])));
    }
  }
}
