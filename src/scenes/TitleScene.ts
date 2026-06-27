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
    // `left` guards every deferred retry below: if the player leaves the title
    // before the track starts — e.g. taps a game on their very first gesture,
    // which is also what unlocks audio — none of the retries may resurrect it.
    let left = false;
    const startMusic = () => { if (!left && !music.isPlaying) music.play(); };
    startMusic();
    // Browsers may not be ready to play right at scene-create; retry shortly,
    // and also on audio-unlock / first tap (autoplay gesture requirement).
    this.time.delayedCall(200, startMusic);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    this.input.once("pointerdown", startMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      left = true;
      // The UNLOCKED listener lives on the global sound manager, which outlives
      // this scene — remove it so a late async unlock can't replay the theme
      // after we've already left the title.
      this.sound.off(Phaser.Sound.Events.UNLOCKED, startMusic);
      music.stop();
      music.destroy();
    });

    this.add
      .text(W / 2, 150, `✨ ${PLAYER_NAME}'s Rainbow Unicorn Adventures ✨`, {
        fontSize: "40px", color: "#7a3fa0", fontStyle: "bold", align: "center",
        wordWrap: { width: W - 80 },
      })
      .setOrigin(0.5);

    // The one unified animated unicorn, used on the title and in both games.
    const uni = this.add.sprite(W / 2, 340, CATCH_UNICORN_KEY).setScale(0.55).play(CATCH_UNICORN_ANIM);
    this.tweens.add({ targets: uni, y: 310, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });

    const MARGIN = 24, GAP = 24, BH = 150;
    const BW = (W - 2 * MARGIN - GAP) / 2;
    const colL = W / 2 - (BW / 2 + GAP / 2), colR = W / 2 + (BW / 2 + GAP / 2);
    const rowY = [560, 730, 900, 1070];
    this.makeGridButton(colL, rowY[0], BW, BH, "🌈", "Rainbow Shoot", 0x9b6bff, () => this.go("Game"));
    this.makeGridButton(colR, rowY[0], BW, BH, "🌈", "Rainbow Catch", 0x7ed957, () => this.go("Catch"));
    this.makeGridButton(colL, rowY[1], BW, BH, "🫧", "Pop the Cuties", 0xff5fa2, () => this.go("Pop"));
    this.makeGridButton(colR, rowY[1], BW, BH, "🎁", "Unicorn Gumballs", 0xff9f43, () => this.go("Gumball"));
    this.makeGridButton(colL, rowY[2], BW, BH, "🔊", "Animal Soundboard", 0x00b4d8, () => this.go("Soundboard"));
    this.makeGridButton(colR, rowY[2], BW, BH, "🐹", "Peekaboo", 0xffd23f, () => this.go("Peekaboo"));
    this.makeGridButton(colL, rowY[3], BW, BH, "🌱", "Grow a Garden", 0x35c46a, () => this.go("Garden"));

    this.events.on("update", (_t: number, dms: number) => this.bg.update(dms / 1000, this.scale.width));
  }

  // Audio can't autoplay before a user gesture, so on a fresh load the title
  // theme is silent until the first tap. If that first tap is a game button it
  // would leave before the music is ever heard — so the audio-unlocking tap
  // only starts the music (via the pointerdown/UNLOCKED retries) and stays on
  // the title; once audio is unlocked, taps enter the game normally.
  private go(key: string) {
    if (this.sound.locked) return;
    this.scene.start(key);
  }

  private makeGridButton(x: number, y: number, w: number, h: number, emoji: string, label: string, color: number, onTap: () => void) {
    const g = this.add.graphics();
    g.fillStyle(color, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 26);
    this.add.text(x, y - 28, emoji, { fontSize: "48px" }).setOrigin(0.5);
    this.add.text(x, y + 34, label, {
      fontSize: "26px", color: "#ffffff", fontStyle: "bold", align: "center", wordWrap: { width: w - 24 },
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", onTap);
  }
}
