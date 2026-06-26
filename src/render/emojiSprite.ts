import Phaser from "phaser";
import { EMOJI } from "./emoji";

// Spawn a looping animated-emoji sprite for an item/enemy `type`.
export function spawnEmoji(scene: Phaser.Scene, x: number, y: number, type: string): Phaser.GameObjects.Sprite {
  const d = EMOJI[type];
  return scene.add.sprite(x, y, d.key).play(d.anim);
}

// Reuse a pooled sprite as `type` at (x, y) — switches the animation + reactivates.
export function resetEmoji(sprite: Phaser.GameObjects.Sprite, type: string, x: number, y: number): Phaser.GameObjects.Sprite {
  const d = EMOJI[type];
  sprite.setPosition(x, y).setActive(true).setVisible(true);
  sprite.play(d.anim);
  return sprite;
}
