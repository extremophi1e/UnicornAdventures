import Phaser from "phaser";
import { Background } from "./ui/Background";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { settings } from "../state/settings";

const PLAYER_NAME = "Zoe";

export class TitleScene extends Phaser.Scene {
  private bg!: Background;
  constructor() {
    super("Title");
  }
  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.bg = new Background(this, W, H);

    this.add
      .text(W / 2, 220, `✨ ${PLAYER_NAME}'s Rainbow Unicorn ✨`, {
        fontSize: "44px", color: "#7a3fa0", fontStyle: "bold", align: "center",
        wordWrap: { width: W - 80 },
      })
      .setOrigin(0.5);

    const uni = this.add.image(W / 2, 430, ATLAS_KEY, frameFor("unicorn")).setScale(2.2);
    uni.setTint(0xff8fcf);
    this.tweens.add({ targets: uni, y: 400, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });

    this.makeButton(W / 2, 720, "▶  Play", 0xff7eb6, () => this.scene.start("Game"));
    this.makeButton(W / 2, 880, "🌈  Rainbow Mode", 0x7ec8ff, () => this.scene.start("Rainbow"));
    this.makeButton(W / 2, 1040, "🌈  Rainbow Catch", 0x7ed957, () => this.scene.start("Catch"));

    // Calm toggle — TOP corner (off the bottom edge per spec).
    this.makeCalmToggle(W - 90, 80);

    this.events.on("update", (_t: number, dms: number) => this.bg.update(dms / 1000, this.scale.width));
  }

  private makeButton(x: number, y: number, label: string, color: number, onTap: () => void) {
    const w = 460, h = 110;
    const g = this.add.graphics();
    g.fillStyle(color, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 28);
    const t = this.add.text(x, y, label, { fontSize: "40px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", onTap);
    return { g, t, zone };
  }

  private makeCalmToggle(x: number, y: number) {
    const label = () => (settings.calm ? "🌙" : "✨");
    const t = this.add.text(x, y, label(), { fontSize: "48px" }).setOrigin(0.5);
    const zone = this.add.zone(x, y, 90, 90).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => {
      settings.toggleCalm();
      t.setText(label());
    });
  }
}
