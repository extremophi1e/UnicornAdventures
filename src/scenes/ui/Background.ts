import Phaser from "phaser";

export class Background extends Phaser.GameObjects.Container {
  private sky: Phaser.GameObjects.Graphics;
  private clouds: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.sky = scene.add.graphics();
    this.add(this.sky);
    for (let i = 0; i < 5; i++) {
      const c = scene.add.circle(0, 0, 60, 0xffffff, 0.5);
      this.clouds.push(c);
      this.add(c);
    }
    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this.sky.clear();
    // Soft rainbow-sky vertical gradient via stacked bands.
    const bands = [0xa0e9ff, 0xc4f0ff, 0xffe6f7, 0xfff3d6, 0xe6ffe9];
    const bandH = height / bands.length;
    bands.forEach((c, i) => this.sky.fillStyle(c, 1).fillRect(0, i * bandH, width, bandH + 1));
    this.clouds.forEach((c, i) => c.setPosition((width / 6) * (i + 1), 120 + (i % 2) * 90));
  }

  update(dt: number, width: number): void {
    for (const c of this.clouds) {
      c.x += 12 * dt;
      if (c.x > width + 80) c.x = -80;
    }
  }
}
