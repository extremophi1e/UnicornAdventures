import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { GameScene } from "./scenes/GameScene";
import { CatchScene } from "./scenes/CatchScene";
import { PopScene } from "./scenes/PopScene";
import { computeLogicalWidth, LOGICAL_HEIGHT } from "./core/viewport";
import { maybeShowIosInstallHint, requestFullscreenOnce } from "./pwa/installHint";
export { computeLogicalWidth, LOGICAL_HEIGHT } from "./core/viewport";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#8ec5ff",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: computeLogicalWidth(window.innerWidth, window.innerHeight),
    height: LOGICAL_HEIGHT,
  },
  scene: [BootScene, TitleScene, GameScene, CatchScene, PopScene],
});

(window as unknown as { __game?: Phaser.Game }).__game = game;

maybeShowIosInstallHint();
requestFullscreenOnce();

function applySize() {
  const w = computeLogicalWidth(window.innerWidth, window.innerHeight);
  game.scale.setGameSize(w, LOGICAL_HEIGHT);
  game.events.emit("logicalresize", w, LOGICAL_HEIGHT);
}
window.addEventListener("resize", applySize);
window.addEventListener("orientationchange", applySize);
