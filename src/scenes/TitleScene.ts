import Phaser from "phaser";
import { Background } from "./ui/Background";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM } from "../render/catchUnicorn";

const PLAYER_NAME = "Zoe and Desi";

export class TitleScene extends Phaser.Scene {
  private bg!: Background;
  constructor() {
    super("Title");
  }
  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.bg = new Background(this, W, H);

    // Upbeat title theme (loops). Stops when leaving the title.
    const music = this.sound.add("title", { loop: true, volume: 0.5 });
    const startMusic = () => { if (!music.isPlaying) music.play(); };
    startMusic();
    // Browsers may not be ready to play right at scene-create; retry shortly,
    // and also on audio-unlock / first tap (autoplay gesture requirement).
    this.time.delayedCall(200, startMusic);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    this.input.once("pointerdown", startMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => music.stop());

    this.add
      .text(W / 2, 220, `✨ ${PLAYER_NAME}'s Rainbow Unicorn Adventures ✨`, {
        fontSize: "40px", color: "#7a3fa0", fontStyle: "bold", align: "center",
        wordWrap: { width: W - 80 },
      })
      .setOrigin(0.5);

    // The one unified animated unicorn, used on the title and in both games.
    const uni = this.add.sprite(W / 2, 430, CATCH_UNICORN_KEY).setScale(0.8).play(CATCH_UNICORN_ANIM);
    this.tweens.add({ targets: uni, y: 400, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });

    this.makeButton(W / 2, 720, "🌈", "Rainbow Shoot", 0x9b6bff, () => this.scene.start("Game"));
    this.makeButton(W / 2, 880, "🌈", "Rainbow Catch", 0x7ed957, () => this.scene.start("Catch"));
    this.makeButton(W / 2, 1040, "🫧", "Pop the Cuties", 0xff5fa2, () => this.scene.start("Pop"));

    this.events.on("update", (_t: number, dms: number) => this.bg.update(dms / 1000, this.scale.width));
  }

  private makeButton(x: number, y: number, emoji: string, label: string, color: number, onTap: () => void) {
    const w = 460, h = 110;
    const ICON_W = 42; // reserved visual width for the emoji glyph (≈ fontSize)
    const GAP = 14;    // small, comfortable gap between the emoji and the label
    const g = this.add.graphics();
    g.fillStyle(color, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 28);
    // Render the emoji and label as separate objects (one centered string would
    // split the emoji's wide trailing advance into a large visible gap). The
    // emoji+label group is centered as a unit; the gap between them is fixed.
    const t = this.add.text(0, y, label, { fontSize: "40px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0, 0.5);
    const left = x - (ICON_W + GAP + t.width) / 2;
    t.x = left + ICON_W + GAP;
    const icon = this.add.text(left, y, emoji, { fontSize: "40px" }).setOrigin(0, 0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", onTap);
    return { g, t, icon, zone };
  }
}
