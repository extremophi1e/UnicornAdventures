import Phaser from "phaser";
import { settings } from "../state/settings";

export class Sound {
  constructor(private scene: Phaser.Scene) {}
  playMusic(): void {
    const vol = settings.calm ? 0.25 : 0.5;
    const m = this.scene.sound.add("music", { loop: true, volume: vol });
    m.play();
  }
  pop(): void {
    this.scene.sound.play("pop", { volume: settings.calm ? 0.3 : 0.6 });
  }
  fanfare(): void {
    this.scene.sound.play("fanfare", { volume: settings.calm ? 0.35 : 0.7 });
  }
  tada(): void {
    this.scene.sound.play("tada", { volume: settings.calm ? 0.4 : 0.8 });
  }
}
