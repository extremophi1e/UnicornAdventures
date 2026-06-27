import Phaser from "phaser";
import { ATLAS_KEY, frameFor } from "../../render/sprites";

export class Celebrations {
  constructor(private scene: Phaser.Scene) {}
  popAt(x: number, y: number) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const s = this.scene.add.image(x, y, ATLAS_KEY, frameFor("sparkle")).setScale(0.6);
      const ang = (Math.PI * 2 * i) / n;
      this.scene.tweens.add({
        targets: s, x: x + Math.cos(ang) * 60, y: y + Math.sin(ang) * 60,
        alpha: 0, duration: 400, onComplete: () => s.destroy(),
      });
    }
  }
  banner(text: string, color = "#ff5fa2", holdMs = 600) {
    const W = this.scene.scale.width;
    const t = this.scene.add.text(W / 2, 360, text, { fontSize: "60px", color, fontStyle: "bold" }).setOrigin(0.5).setScale(0);
    this.scene.tweens.add({ targets: t, scale: 1, yoyo: true, hold: holdMs, duration: 300, onComplete: () => t.destroy() });
  }

  bigParty() {
    const W = this.scene.scale.width, H = this.scene.scale.height;
    const n = 70;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const s = this.scene.add.image(x, -20, ATLAS_KEY, frameFor("sparkle")).setScale(0.5 + Math.random());
      this.scene.tweens.add({ targets: s, y: H + 40, alpha: 0, duration: 1200 + Math.random() * 1200, onComplete: () => s.destroy() });
    }
    this.scene.cameras.main.shake(250, 0.004);
  }

  bigPartyNoShake() {
    const W = this.scene.scale.width, H = this.scene.scale.height;
    const n = 70;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const s = this.scene.add.image(x, -20, ATLAS_KEY, frameFor("sparkle")).setScale(0.5 + Math.random());
      this.scene.tweens.add({ targets: s, y: H + 40, alpha: 0, duration: 1200 + Math.random() * 1200, onComplete: () => s.destroy() });
    }
  }

  finale() {
    this.bigParty();
    this.banner(`YOU DID IT! 🦄🌈`, "#ff3f8a", 4500);
    // Keep the party going: two extra bigParty bursts spread across the hold window.
    this.scene.time.delayedCall(1500, () => this.bigParty());
    this.scene.time.delayedCall(3000, () => this.bigParty());
  }
}
