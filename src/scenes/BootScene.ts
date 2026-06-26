import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  create() {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, "🦄 Zoe's Rainbow Unicorn", {
        fontSize: "48px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }
}
