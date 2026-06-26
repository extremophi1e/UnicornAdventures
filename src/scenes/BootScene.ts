import Phaser from "phaser";
import { ATLAS_KEY } from "../render/sprites";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_SHEET, CATCH_UNICORN_ANIM, CATCH_UNICORN } from "../render/catchUnicorn";

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
    this.load.audio("catch1", ["audio/catch1.mp3"]);
    this.load.audio("catch2", ["audio/catch2.mp3"]);
    this.load.audio("catch3", ["audio/catch3.mp3"]);
    this.load.audio("collect", ["audio/collect.mp3"]);
    this.load.audio("pop", ["audio/pop.mp3"]);
    this.load.audio("fanfare", ["audio/fanfare.mp3"]);
    this.load.audio("tada", ["audio/tada.mp3"]);
    this.load.spritesheet(CATCH_UNICORN_KEY, CATCH_UNICORN_SHEET, {
      frameWidth: CATCH_UNICORN.frameWidth,
      frameHeight: CATCH_UNICORN.frameHeight,
    });
    // Loading progress bar (no text — pre-readers).
    const g = this.add.graphics();
    this.load.on("progress", (p: number) => {
      g.clear().fillStyle(0xffffff, 0.9).fillRect(160, 630, 400 * p, 20);
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
    this.scene.start("Title");
  }
}
