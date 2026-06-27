import Phaser from "phaser";
import { CatchBackground } from "./ui/CatchBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM, CATCH_UNICORN } from "../render/catchUnicorn";
import { resolveTarget, type AimInput, type Bounds } from "../core/input";
import { circleOverlap } from "../core/collision";
import { Sound, CATCH_MUSIC_KEYS } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { initialCatchState, recordCatch, recordMiss, speedForNotch, type CatchState } from "../core/catch";
import { shouldSpawnBonus } from "../core/pop";
import { EMOJI } from "../render/emoji";

const KEY_SPEED = 4800;        // px/s for arrow-key movement (3x faster)
const SPAWN_INTERVAL = 1.1;    // seconds, fixed (independent of fall speed)
const MAX_CONCURRENT = 10;     // cap on-screen items
const CATCH_RADIUS = 95;       // generous; larger than the visible unicorn
const CELEBRATION_EVERY = 10;  // catches per milestone celebration
const UNICORN_DISPLAY_H = 150; // target on-screen unicorn height in px
const FINGER_LIFT = 120;       // on touch, float the unicorn this far above the finger so it isn't hidden
const ITEM_SCALE = 1.1 / 2;    // /2: emoji frames are 144px (2x the old 72px)
const GIANT_GEM_SCALE = 2.6 / 2; // the rare giant gem — ~2.4x a normal item, unmistakable
const GIANT_CATCH_RADIUS = 150;  // bigger pickup radius to match the giant body

// Every emoji EXCEPT the gem — the gem only appears as the rare GIANT gem power-up
// (caught, it sweeps up everything on screen). Auto-updates if more emoji are added.
const CATCH_ITEM_TYPES = Object.keys(EMOJI).filter((k) => k !== "gem");

// Rainbow trail colours dropped behind the unicorn while it moves (ROYGBIV).
const RAINBOW_TRAIL_COLORS = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00a3ff, 0x5e5ce6, 0xaf52de];

export class CatchScene extends Phaser.Scene {
  private bg!: CatchBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private unicorn!: Phaser.GameObjects.Sprite;
  private target = { x: 0, y: 0 };
  private pointerActive = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private items!: Phaser.GameObjects.Group;
  private spawnTimer = 0;
  private spawnsSinceGiant = 0;

  private state: CatchState = initialCatchState();
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;

  // Rainbow trail bookkeeping.
  private _prevX = 0;
  private _prevY = 0;
  private _trailColor = 0;
  private _trailAccum = 0;

  constructor() {
    super("Catch");
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.bg = new CatchBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.sound2.playMusic(CATCH_MUSIC_KEYS);
    this.fx = new Celebrations(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sound.stopAll());

    this.state = initialCatchState();
    this.score = 0;

    this.target = { x: W / 2, y: H * 0.55 };
    this.unicorn = this.add.sprite(this.target.x, this.target.y, CATCH_UNICORN_KEY).setDepth(10);
    this.unicorn.setScale(UNICORN_DISPLAY_H / CATCH_UNICORN.frameHeight);
    this.unicorn.play(CATCH_UNICORN_ANIM);
    this._prevX = this.target.x;
    this._prevY = this.target.y;

    this.cursors = this.input.keyboard!.createCursorKeys();
    // Touch lifts the unicorn above the finger so it isn't hidden; mouse aims exactly.
    const setTarget = (p: Phaser.Input.Pointer) => {
      this.pointerActive = true;
      this.target = { x: p.worldX, y: p.worldY - (p.wasTouch ? FINGER_LIFT : 0) };
    };
    this.input.on("pointermove", setTarget);
    this.input.on("pointerdown", setTarget);

    this.items = this.add.group();
    this.spawnTimer = 0;
    this.spawnsSinceGiant = 0;

    this.scoreText = this.add.text(24, 24, "⭐ 0", {
      fontSize: "44px", color: "#ffffff", fontStyle: "bold", stroke: "#2f7d2a", strokeThickness: 6,
    }).setDepth(1000);

    // Simple "back to title" tap target (top-right). No game-over otherwise.
    const back = this.add.text(W - 24, 24, "⬅", { fontSize: "44px" }).setOrigin(1, 0).setDepth(1000)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("Title"));
  }

  private bounds(): Bounds {
    return { minX: 60, maxX: this.scale.width - 60, minY: 140, maxY: this.scale.height - 120 };
  }

  private aimInput(): AimInput {
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

  private spawnItem() {
    // Rarely (gated by the shared bonus cadence) spawn a GIANT gem power-up instead.
    const giant = shouldSpawnBonus(this.spawnsSinceGiant, Math.random);
    this.spawnsSinceGiant = giant ? 0 : this.spawnsSinceGiant + 1;

    const type = giant ? "gem" : CATCH_ITEM_TYPES[Math.floor(Math.random() * CATCH_ITEM_TYPES.length)];
    const scale = giant ? GIANT_GEM_SCALE : ITEM_SCALE;
    const x = 80 + Math.random() * (this.scale.width - 160);
    let c = this.items.getFirstDead(false) as Phaser.GameObjects.Sprite | null;
    if (!c) {
      c = spawnEmoji(this, x, -40, type).setScale(scale);
      this.items.add(c);
    } else {
      resetEmoji(c, type, x, -40).setScale(scale);
    }
    c.setData("giant", giant);
  }

  private celebrate() {
    this.fx.bigParty();
    this.fx.banner("🌈");
    this.sound2.fanfare();
  }

  // Catch one item: count it, sparkle + sound, recycle. No milestone check here —
  // callers decide when to celebrate so the giant sweep doesn't double-fire it.
  private catchOne(c: Phaser.GameObjects.Sprite) {
    this.items.killAndHide(c);
    this.state = recordCatch(this.state);
    this.score += 1;
    this.scoreText.setText(`⭐ ${this.score}`);
    this.fx.popAt(c.x, c.y);
    this.sound2.collect();
  }

  // The rare GIANT gem: catches every falling item at once (each counts +1),
  // then one big celebration. No difficulty reset — just the per-catch ladder.
  private catchGiant(giant: Phaser.GameObjects.Sprite) {
    this.catchOne(giant);
    (this.items.getChildren() as Phaser.GameObjects.Sprite[])
      .filter((c) => c.active && c !== giant)
      .forEach((c) => this.catchOne(c));
    this.celebrate();
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.bg.update(dt);

    // Movement: pointer-follow, or arrow keys take over while held.
    if (this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown || this.cursors.down.isDown) {
      this.pointerActive = false;
    }
    const cur = { x: this.unicorn.x, y: this.unicorn.y };
    const next = resolveTarget(cur, this.aimInput(), KEY_SPEED, dt, this.bounds());
    this.unicorn.x = Phaser.Math.Linear(this.unicorn.x, next.x, Math.min(1, 12 * dt));
    this.unicorn.y = Phaser.Math.Linear(this.unicorn.y, next.y, Math.min(1, 12 * dt));

    // Rainbow trail: drop fading rainbow circles behind the unicorn while moving.
    const tdx = this.unicorn.x - this._prevX;
    const tdy = this.unicorn.y - this._prevY;
    this._trailAccum += dt;
    if (Math.sqrt(tdx * tdx + tdy * tdy) > 2 && this._trailAccum >= 0.025) {
      this._trailAccum = 0;
      const color = RAINBOW_TRAIL_COLORS[this._trailColor];
      this._trailColor = (this._trailColor + 1) % RAINBOW_TRAIL_COLORS.length;
      const dot = this.add.circle(this.unicorn.x, this.unicorn.y + 12, 16, color).setDepth(5);
      this.tweens.add({
        targets: dot,
        alpha: { from: 0.9, to: 0 },
        scale: { from: 1, to: 0.2 },
        duration: 520,
        ease: "Sine.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
    this._prevX = this.unicorn.x;
    this._prevY = this.unicorn.y;

    // Spawn at a fixed interval, capped.
    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL) {
      this.spawnTimer = 0;
      if (this.items.countActive(true) < MAX_CONCURRENT) this.spawnItem();
    }

    // Fall + catch/miss. One global speed applied to all in-flight items.
    const speed = speedForNotch(this.state.notch);
    const ux = this.unicorn.x, uy = this.unicorn.y;
    (this.items.getChildren() as Phaser.GameObjects.Sprite[]).forEach((c) => {
      if (!c.active) return;
      c.y += speed * dt;

      const giant = c.getData("giant") as boolean;
      const r = giant ? GIANT_CATCH_RADIUS : CATCH_RADIUS;
      if (circleOverlap({ x: c.x, y: c.y, r }, { x: ux, y: uy, r: 0 })) {
        if (giant) {
          this.catchGiant(c);
        } else {
          this.catchOne(c);
          if (this.score % CELEBRATION_EVERY === 0) this.celebrate();
        }
        return;
      }

      if (c.y > this.scale.height + 50) {
        this.items.killAndHide(c);
        this.state = recordMiss(this.state);
      }
    });
  }
}
