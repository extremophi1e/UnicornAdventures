import Phaser from "phaser";
import { ATLAS_KEY } from "../render/sprites";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_SHEET, CATCH_UNICORN_ANIM, CATCH_UNICORN } from "../render/catchUnicorn";
import { EMOJI_DEFS } from "../render/emoji";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    this.load.atlas(ATLAS_KEY, "atlas/openmoji.png", "atlas/openmoji.json");
    this.load.audio("music1", ["audio/music1.mp3"]);
    this.load.audio("music2", ["audio/music2.mp3"]);
    this.load.audio("music3", ["audio/music3.mp3"]);
    this.load.audio("music4", ["audio/music4.mp3"]);
    this.load.audio("title", ["audio/title.mp3"]);
    this.load.audio("popmusic", ["audio/popmusic.mp3"]);
    this.load.audio("gumball", ["audio/gumball.mp3"]);
    this.load.audio("catch1", ["audio/catch1.mp3"]);
    this.load.audio("catch2", ["audio/catch2.mp3"]);
    this.load.audio("catch3", ["audio/catch3.mp3"]);
    this.load.audio("collect", ["audio/collect.mp3"]);
    this.load.audio("pop", ["audio/pop.mp3"]);
    this.load.audio("fanfare", ["audio/fanfare.mp3"]);
    this.load.audio("tada", ["audio/tada.mp3"]);
    this.load.audioSprite("animalvoices", "audio/animalvoices.json", ["audio/animalvoices.mp3"]);
    this.load.audio("giggle1", ["audio/giggle1.mp3"]);
    this.load.audio("giggle2", ["audio/giggle2.mp3"]);
    this.load.audio("giggle3", ["audio/giggle3.mp3"]);
    this.load.spritesheet(CATCH_UNICORN_KEY, CATCH_UNICORN_SHEET, {
      frameWidth: CATCH_UNICORN.frameWidth,
      frameHeight: CATCH_UNICORN.frameHeight,
    });
    for (const d of EMOJI_DEFS) {
      this.load.spritesheet(d.key, d.sheet, { frameWidth: d.frameWidth, frameHeight: d.frameHeight });
    }
    // Loading progress bar (no text — pre-readers). Centered so it fits any width.
    const g = this.add.graphics();
    const barW = 400;
    const barX = (this.scale.width - barW) / 2;
    this.load.on("progress", (p: number) => {
      g.clear().fillStyle(0xffffff, 0.9).fillRect(barX, 630, barW * p, 20);
    });
  }
  create() {
    // Register the looping catch-unicorn animation globally (once).
    if (!this.anims.exists(CATCH_UNICORN_ANIM)) {
      this.anims.create({
        key: CATCH_UNICORN_ANIM,
        frames: this.anims.generateFrameNumbers(CATCH_UNICORN_KEY, { start: 0, end: CATCH_UNICORN.frameCount - 1 }),
        frameRate: CATCH_UNICORN.frameRate,
        repeat: -1,
      });
    }
    for (const d of EMOJI_DEFS) {
      if (!this.anims.exists(d.anim)) {
        this.anims.create({
          key: d.anim,
          frames: this.anims.generateFrameNumbers(d.key, { start: 0, end: d.frameCount - 1 }),
          frameRate: d.frameRate,
          repeat: -1,
        });
      }
    }
    this.scene.start("Title");
  }
}
