import Phaser from "phaser";

// Calm cozy-playroom background for Unicorn Gumballs: a warm cream->peach
// gradient with softly drifting polka dots, deliberately low-contrast so the
// busy rainbow machine + flashes read clearly on top.
export class PlayroomBackground extends Phaser.GameObjects.Container {
  private wall: Phaser.GameObjects.Graphics;
  private dots: Phaser.GameObjects.Arc[] = [];
  private dotPhase: number[] = [];
  private _t = 0;
  private _w = 0;
  private _h = 0;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(-10);

    this.wall = scene.add.graphics();
    this.add(this.wall);

    for (let i = 0; i < 22; i++) {
      const d = scene.add.circle(0, 0, 10 + Math.random() * 16, 0xffffff, 0.22);
      this.dots.push(d);
      this.dotPhase.push(Math.random() * Math.PI * 2);
      this.add(d);
    }

    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this._w = width;
    this._h = height;
    // Warm cream -> peach vertical gradient via stacked bands.
    this.wall.clear();
    const bands = [0xfff3e6, 0xffe9d6, 0xffe0cc, 0xffd6c2, 0xffccbb];
    const bandH = height / bands.length;
    bands.forEach((c, i) => this.wall.fillStyle(c, 1).fillRect(0, i * bandH, width, bandH + 1));
    for (const d of this.dots) d.setPosition(Math.random() * width, Math.random() * height);
  }

  update(dt: number, _width: number): void {
    this._t += dt;
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      d.y -= 6 * dt; // very gentle upward drift
      d.x += Math.sin(this._t * 0.6 + this.dotPhase[i]) * 4 * dt;
      if (d.y < -30) { d.y = this._h + 30; d.x = Math.random() * this._w; }
    }
  }
}
