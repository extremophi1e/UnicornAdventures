import Phaser from "phaser";
import { ATLAS_KEY, frameFor } from "../../render/sprites";
import { settings } from "../../state/settings";

export class Celebrations {
  constructor(private scene: Phaser.Scene) {}
  popAt(x: number, y: number) {
    const n = settings.calm ? 3 : 8;
    for (let i = 0; i < n; i++) {
      const s = this.scene.add.image(x, y, ATLAS_KEY, frameFor("sparkle")).setScale(0.6);
      const ang = (Math.PI * 2 * i) / n;
      this.scene.tweens.add({
        targets: s, x: x + Math.cos(ang) * 60, y: y + Math.sin(ang) * 60,
        alpha: 0, duration: 400, onComplete: () => s.destroy(),
      });
    }
  }
  banner(text: string, color = "#ff5fa2") {
    const W = this.scene.scale.width;
    const t = this.scene.add.text(W / 2, 360, text, { fontSize: "60px", color, fontStyle: "bold" }).setOrigin(0.5).setScale(0);
    this.scene.tweens.add({ targets: t, scale: 1, yoyo: true, hold: 600, duration: 300, onComplete: () => t.destroy() });
  }
}
