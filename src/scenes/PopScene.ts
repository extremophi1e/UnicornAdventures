import Phaser from "phaser";
import { UnderwaterBackground } from "./ui/UnderwaterBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { Sound } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { initialCatchState, recordCatch, recordMiss, speedForNotch, type CatchState } from "../core/catch";
import { pickNearestWithinRadius, shouldSpawnBonus } from "../core/pop";

const SPAWN_INTERVAL = 0.9;          // seconds, fixed (independent of float speed)
const MAX_CONCURRENT = 12;           // cap on-screen cuties
const POP_RADIUS = 90;               // generous tap radius (~1.5x sprite)
const CELEBRATION_EVERY = 20;        // pops per milestone celebration
const ITEM_SCALE = 1.1;
const BONUS_SCALE = 1.8;
const BURST_PARTICLES = 12;
const BURST_PARTICLES_REDUCED = 4;

// Cute, non-disappearing types (keys from src/render/emoji.ts; note icecream/
// donut/cupcake/lollipop now render tulip/ladybug/clover/cat). No cloud.
const POP_ITEM_TYPES = ["star", "heart", "flower", "butterfly", "gem", "balloon", "icecream", "donut", "cupcake", "lollipop"];

// Rainbow tint cycle for the bonus cutie (ROYGBIV).
const RAINBOW_COLORS = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00a3ff, 0x5e5ce6, 0xaf52de];

export class PopScene extends Phaser.Scene {
  private bg!: UnderwaterBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;

  private cuties!: Phaser.GameObjects.Group;
  private spawnTimer = 0;
  private spawnsSinceBonus = 0;
  private _t = 0;

  private state: CatchState = initialCatchState();
  private popCount = 0;
  private celebratedUpTo = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private reduceMotion = false;

  constructor() { super("Pop"); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.reduceMotion = (typeof window !== "undefined" && window.matchMedia)
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

    this.bg = new UnderwaterBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.fx = new Celebrations(this);

    // Shared, pooled particle burst (sparkle frame from the OpenMoji atlas).
    this.burst = this.add.particles(0, 0, ATLAS_KEY, {
      frame: frameFor("sparkle"),
      speed: { min: 120, max: 280 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 420,
      quantity: 1,
      emitting: false,
    }).setDepth(50);

    this.state = initialCatchState();
    this.popCount = 0;
    this.celebratedUpTo = 0;
    this.spawnTimer = 0;
    this.spawnsSinceBonus = 0;
    this._t = 0;

    this.cuties = this.add.group();

    // Dedicated looping music (quieter so the pop SFX stay crisp). Robust autoplay
    // (immediate + delayed retry + unlock/first-tap), stopped on shutdown.
    const music = this.sound.add("popmusic", { loop: true, volume: 0.38 });
    const startMusic = () => { if (!music.isPlaying) music.play(); };
    startMusic();
    this.time.delayedCall(200, startMusic);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    this.input.once("pointerdown", startMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { music.stop(); this.sound.stopAll(); });

    // Multi-touch: up to 4 simultaneous fingers; each pops the nearest cutie.
    this.input.addPointer(3);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.tryPop(p.worldX, p.worldY));

    this.scoreText = this.add.text(24, 24, "⭐ 0", {
      fontSize: "44px", color: "#ffffff", fontStyle: "bold", stroke: "#075e63", strokeThickness: 6,
    }).setDepth(1000);

    // Back to title (top-right) — no game-over otherwise.
    const back = this.add.text(W - 24, 24, "⬅", { fontSize: "44px" }).setOrigin(1, 0).setDepth(1000)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("Title"));
  }

  private spawnCutie() {
    const W = this.scale.width, H = this.scale.height;
    const x = 80 + Math.random() * (W - 160);
    const isBonus = shouldSpawnBonus(this.spawnsSinceBonus, Math.random);
    const type = isBonus ? "gem" : POP_ITEM_TYPES[Math.floor(Math.random() * POP_ITEM_TYPES.length)];

    let c = this.cuties.getFirstDead(false) as Phaser.GameObjects.Sprite | null;
    if (!c) {
      c = spawnEmoji(this, x, H + 40, type);
      this.cuties.add(c);
    } else {
      this.tweens.killTweensOf(c);
      resetEmoji(c, type, x, H + 40);
    }
    c.setScale(isBonus ? BONUS_SCALE : ITEM_SCALE).setAlpha(1).setAngle(0).clearTint();
    c.setData("baseX", x);
    c.setData("swayPhase", Math.random() * Math.PI * 2);
    c.setData("swayFreq", 1.5 + Math.random() * 1.5);
    c.setData("swayAmp", 20 + Math.random() * 30);
    c.setData("speedMul", 0.85 + Math.random() * 0.3);
    c.setData("bonus", isBonus);

    if (isBonus) {
      this.spawnsSinceBonus = 0;
      // Rainbow colour-cycle + gentle pulse so it reads as special.
      this.tweens.addCounter({
        from: 0, to: RAINBOW_COLORS.length, duration: 1400, repeat: -1,
        onUpdate: (tw) => { if (c!.active) c!.setTint(RAINBOW_COLORS[Math.floor(tw.getValue() ?? 0) % RAINBOW_COLORS.length]); },
      });
      this.tweens.add({ targets: c, scale: BONUS_SCALE * 1.12, yoyo: true, repeat: -1, duration: 520, ease: "Sine.inOut" });
    } else {
      this.spawnsSinceBonus += 1;
    }
  }

  private explodeBurst(x: number, y: number) {
    this.burst.explode(this.reduceMotion ? BURST_PARTICLES_REDUCED : BURST_PARTICLES, x, y);
  }

  // Pop a single cutie: count it, burst + sound, squash, recycle.
  private popOne(c: Phaser.GameObjects.Sprite) {
    c.setActive(false);
    this.tweens.killTweensOf(c);
    this.popCount += 1;
    this.state = recordCatch(this.state);
    this.scoreText.setText(`⭐ ${this.popCount}`);
    this.explodeBurst(c.x, c.y);
    this.sound.play("pop", { detune: Phaser.Math.Between(-120, 120), volume: 0.6 });
    this.tweens.add({
      targets: c, scaleX: c.scaleX * 1.4, scaleY: c.scaleY * 0.6, alpha: 0,
      duration: 140, ease: "Back.easeIn", onComplete: () => this.cuties.killAndHide(c),
    });
  }

  private tryPop(px: number, py: number) {
    const actives = (this.cuties.getChildren() as Phaser.GameObjects.Sprite[]).filter((c) => c.active);
    if (!actives.length) return;
    const idx = pickNearestWithinRadius(px, py, actives.map((c) => ({ x: c.x, y: c.y })), POP_RADIUS);
    if (idx < 0) return;
    const hit = actives[idx];
    if (hit.getData("bonus")) this.popBonus(hit);
    else { this.popOne(hit); this.milestoneCheck(); }
  }

  // Bonus pop: the bonus counts +1, then clears every other active cutie
  // (each counts +1), then one big party + a single milestone check.
  private popBonus(bonus: Phaser.GameObjects.Sprite) {
    this.popOne(bonus);
    (this.cuties.getChildren() as Phaser.GameObjects.Sprite[])
      .filter((c) => c.active && c !== bonus)
      .forEach((c) => this.popOne(c));
    this.party();
    this.sound2.tada();
    if (!this.reduceMotion) this.cameras.main.shake(220, 0.004);
    this.milestoneCheck();
  }

  private party() {
    if (this.reduceMotion) { this.fx.banner("🌈"); }
    else { this.fx.bigParty(); this.fx.banner("🌈"); }
  }

  private milestoneCheck() {
    const m = Math.floor(this.popCount / CELEBRATION_EVERY);
    if (m > this.celebratedUpTo) {
      this.celebratedUpTo = m;
      this.party();
      this.sound2.fanfare();
    }
  }

  // A cutie reached the top un-popped: gentle float-away wave, counts as a miss.
  private escape(c: Phaser.GameObjects.Sprite) {
    c.setActive(false);
    this.tweens.killTweensOf(c);
    this.state = recordMiss(this.state);
    this.tweens.add({
      targets: c, y: c.y - 36, alpha: 0, angle: 12,
      duration: 300, ease: "Sine.easeOut", onComplete: () => this.cuties.killAndHide(c),
    });
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this._t += dt;
    this.bg.update(dt, this.scale.width);

    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL) {
      this.spawnTimer = 0;
      if (this.cuties.countActive(true) < MAX_CONCURRENT) this.spawnCutie();
    }

    const speed = speedForNotch(this.state.notch);
    (this.cuties.getChildren() as Phaser.GameObjects.Sprite[]).forEach((c) => {
      if (!c.active) return;
      c.y -= speed * (c.getData("speedMul") as number) * dt;
      c.x = (c.getData("baseX") as number)
        + Math.sin(this._t * (c.getData("swayFreq") as number) + (c.getData("swayPhase") as number)) * (c.getData("swayAmp") as number);
      if (c.y < -60) this.escape(c);
    });
  }
}
