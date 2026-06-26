import Phaser from "phaser";
import { Background } from "./ui/Background";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { AutoFire, resolveTarget, type AimInput, type Bounds } from "../core/input";
import { Sound } from "../audio/sound";

const STAR_SPEED = 900; // px/s upward
const KEY_SPEED = 700;
const FIRE_INTERVAL = 0.18;

export class GameScene extends Phaser.Scene {
  protected bg!: Background;
  protected sound2!: Sound;
  protected unicorn!: Phaser.GameObjects.Container;
  protected target = { x: 360, y: 1120 };
  protected stars!: Phaser.GameObjects.Group;
  protected autofire = new AutoFire(FIRE_INTERVAL);
  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  protected pointerActive = false;

  constructor(key = "Game") {
    super(key);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.bg = new Background(this, W, H);
    this.sound2 = new Sound(this);
    this.sound2.playMusic();

    // Stop music when scene shuts down to avoid layering tracks when transitioning.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sound.stopAll();
    });

    // Unicorn = tinted body + simple drawn wings + sparkle trail anchor.
    const body = this.add.image(0, 0, ATLAS_KEY, frameFor("unicorn")).setScale(1.6).setTint(0xff8fcf);
    const wingL = this.add.triangle(-44, 6, 0, 0, 40, -18, 36, 26, 0xffffff, 0.9);
    const wingR = this.add.triangle(44, 6, 0, 0, -40, -18, -36, 26, 0xffffff, 0.9);
    this.unicorn = this.add.container(this.target.x, this.target.y, [wingL, body, wingR]);

    this.stars = this.add.group();
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown || this.sys.game.device.input.touch === false) {
        this.pointerActive = true;
        this.target = { x: p.worldX, y: p.worldY };
      }
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pointerActive = true;
      this.target = { x: p.worldX, y: p.worldY };
    });
  }

  protected bounds(): Bounds {
    return { minX: 50, maxX: this.scale.width - 50, minY: this.scale.height - 420, maxY: this.scale.height - 70 };
  }

  protected aimInput(): AimInput {
    return {
      pointer: this.pointerActive ? this.target : null,
      keys: {
        left: this.cursors.left.isDown,
        right: this.cursors.right.isDown,
        up: this.cursors.up.isDown,
        down: this.cursors.down.isDown,
      },
    };
  }

  protected fireStar() {
    const x = this.unicorn.x;
    const y = this.unicorn.y - 60;
    let s = this.stars.getFirstDead(false) as Phaser.GameObjects.Image | null;
    if (!s) {
      s = this.add.image(x, y, ATLAS_KEY, frameFor("star")).setScale(0.8);
      this.stars.add(s);
    } else {
      s.setPosition(x, y).setActive(true).setVisible(true);
    }
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.bg.update(dt, this.scale.width);

    if (this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown || this.cursors.down.isDown) {
      this.pointerActive = false; // keyboard takes over
    }
    const cur = { x: this.unicorn.x, y: this.unicorn.y };
    const next = resolveTarget(cur, this.aimInput(), KEY_SPEED, dt, this.bounds());
    // Smooth follow.
    this.unicorn.x = Phaser.Math.Linear(this.unicorn.x, next.x, Math.min(1, 12 * dt));
    this.unicorn.y = Phaser.Math.Linear(this.unicorn.y, next.y, Math.min(1, 12 * dt));

    for (const shot of Array(this.autofire.update(dt)).fill(0)) void shot, this.fireStar();

    (this.stars.getChildren() as Phaser.GameObjects.Image[]).forEach((s) => {
      if (!s.active) return;
      s.y -= STAR_SPEED * dt;
      if (s.y < -40) this.stars.killAndHide(s);
    });
  }
}
