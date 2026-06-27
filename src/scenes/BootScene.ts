import Phaser from "phaser";
import { loadCatchUnicorn, registerCatchUnicornAnim, loadAudio, showLoadingBar } from "../render/assets";

// Boot loads ONLY what the title screen needs — the animated unicorn sheet and
// the title theme. Each game's art + SFX are loaded lazily by that game's own
// preload() on first entry (see src/render/assets.ts); music streams per-track
// on demand from audio/sound.ts. This keeps the initial download tiny.
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    loadCatchUnicorn(this);
    loadAudio(this, ["title"]);
    showLoadingBar(this);
  }
  create() {
    registerCatchUnicornAnim(this);
    this.scene.start("Title");
  }
}
