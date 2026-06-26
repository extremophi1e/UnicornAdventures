import Phaser from "phaser";
import { ATLAS_KEY } from "../render/sprites";

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
    this.load.audio("collect", ["audio/collect.mp3"]);
    this.load.audio("pop", ["audio/pop.mp3"]);
    this.load.audio("fanfare", ["audio/fanfare.mp3"]);
    this.load.audio("tada", ["audio/tada.mp3"]);
    // Loading progress bar (no text — pre-readers).
    const g = this.add.graphics();
    this.load.on("progress", (p: number) => {
      g.clear().fillStyle(0xffffff, 0.9).fillRect(160, 630, 400 * p, 20);
    });
  }
  create() {
    this.scene.start("Title");
  }
}
