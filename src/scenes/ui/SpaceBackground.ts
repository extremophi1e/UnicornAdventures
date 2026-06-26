import Phaser from "phaser";

// Shape-based deep-space background for the shooter. A dark star field with
// twinkling stars and a few slowly drifting planets, so the bright unicorn,
// rainbow stars, and enemies pop. (The old rainbow-sky Background.ts is kept
// for reuse in a future game type.)
export class SpaceBackground extends Phaser.GameObjects.Container {
  private sky: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Arc[] = [];
  private starPhase: number[] = [];
  private planets: Phaser.GameObjects.Arc[] = [];
  private _t = 0;
  private _h = 0;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(-10);

    this.sky = scene.add.graphics();
    this.add(this.sky);

    for (let i = 0; i < 80; i++) {
      const s = scene.add.circle(0, 0, 1 + Math.random() * 2, 0xffffff, 1);
      this.stars.push(s);
      this.starPhase.push(Math.random() * Math.PI * 2);
      this.add(s);
    }

    const defs = [
      { color: 0xff8fcf, r: 46 },
      { color: 0x7ec8ff, r: 30 },
      { color: 0xffd23f, r: 22 },
    ];
    for (const d of defs) {
      const p = scene.add.circle(0, 0, d.r, d.color, 0.9);
      this.planets.push(p);
      this.add(p);
    }

    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this._h = height;

    this.sky.clear();
    const bands = [0x0a0a2a, 0x100f3a, 0x1a0f3a, 0x250b34];
    const bandH = height / bands.length;
    bands.forEach((c, i) => this.sky.fillStyle(c, 1).fillRect(0, i * bandH, width, bandH + 1));

    for (const s of this.stars) s.setPosition(Math.random() * width, Math.random() * height);

    const pos = [
      { x: width * 0.18, y: height * 0.14 },
      { x: width * 0.82, y: height * 0.30 },
      { x: width * 0.6, y: height * 0.6 },
    ];
    this.planets.forEach((p, i) => p.setPosition(pos[i].x, pos[i].y));
  }

  update(dt: number, _width: number): void {
    this._t += dt;
    for (let i = 0; i < this.stars.length; i++) {
      this.stars[i].setAlpha(0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this._t * 3 + this.starPhase[i])));
    }
    for (const p of this.planets) {
      p.y += 6 * dt;
      if (p.y - p.radius > this._h) p.y = -p.radius;
    }
  }
}
