import Phaser from "phaser";
import { AquariumBackground } from "./ui/AquariumBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { Celebrations } from "./ui/Celebrations";
import { pickNearestWithinRadius } from "../core/pop";
import { pickReaction, initialAquariumState, type AquariumState, type Reaction } from "../core/aquarium";

const BASELINE = 7;            // target ambient fish count
const HARD_CAP = 16;          // max concurrent fish
const SPAWN_INTERVAL = 0.8;   // seconds between ambient top-ups (while below baseline)
const TAP_RADIUS = 90;        // generous tap radius for small fingers
const ITEM_SCALE = 1.1 / 2;   // 144px emoji frames -> /2 keeps on-screen size ~79px
const DRIFT_MIN = 35, DRIFT_MAX = 80; // px/s horizontal drift
const NAP_TAPS = 5;           // taps on one fish (within the window) -> nap
const NAP_SECONDS = 2.5;
const TAP_WINDOW = 2.0;       // seconds; a fish's tap counter resets if idle longer
const NAP_SLOW = 0.3;         // drift multiplier while napping

// Curated sea-creature cast (emoji keys) — the 9 proven steady-looping aquatic
// creatures already in src/render/emoji.ts. (Noto's real fish/shark/dolphin/
// blowfish animations flicker/vanish mid-loop, so they are NOT used — see Task 1.)
const AQUARIUM_TYPES = [
  "whale", "turtle", "octopus", "crab", "lobster", "jellyfish", "penguin", "seal", "otter",
];

// Rainbow tint cycle (ROYGBIV) for color-flash + the shockwave overlay.
const RAINBOW_COLORS = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00a3ff, 0x5e5ce6, 0xaf52de];

type Fish = Phaser.GameObjects.Sprite;

export class AquariumScene extends Phaser.Scene {
  private bg!: AquariumBackground;
  private fx!: Celebrations;

  private fish!: Phaser.GameObjects.Group;
  private spawnTimer = 0;
  private _t = 0;
  private reduceMotion = false;
  private aqState: AquariumState = initialAquariumState();

  constructor() { super("Aquarium"); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.reduceMotion = (typeof window !== "undefined" && window.matchMedia)
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

    this.bg = new AquariumBackground(this, W, H);
    this.fx = new Celebrations(this);

    this.fish = this.add.group();
    this.spawnTimer = 0;
    this._t = 0;
    this.aqState = initialAquariumState();

    // Dedicated looping music (quieter so SFX stay crisp). Robust autoplay
    // (immediate + delayed retry + unlock/first-tap), stopped on shutdown.
    const music = this.sound.add("aquarium", { loop: true, volume: 0.38 });
    const startMusic = () => { if (!music.isPlaying) music.play(); };
    startMusic();
    this.time.delayedCall(200, startMusic);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    this.input.once("pointerdown", startMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      music.stop();
      this.sound.stopAll();
      // Destroy any lingering 💤 labels.
      (this.fish.getChildren() as Fish[]).forEach((f) => {
        const z = f.getData("zzz") as Phaser.GameObjects.Text | null;
        if (z) z.destroy();
      });
    });

    // Multi-touch: up to 4 fingers; each taps the nearest fish.
    this.input.addPointer(3);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.tryTap(p.worldX, p.worldY));

    // Back to title (top-right) — no game-over otherwise.
    const back = this.add.text(W - 24, 24, "⬅", { fontSize: "44px" }).setOrigin(1, 0).setDepth(1000)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("Title"));

    // Start the tank already populated (fish spread across the screen).
    for (let i = 0; i < BASELINE; i++) {
      const x = 60 + Math.random() * (W - 120);
      const y = 150 + Math.random() * (H - 320);
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.spawnFishAt(x, y, dir, AQUARIUM_TYPES[Math.floor(Math.random() * AQUARIUM_TYPES.length)]);
    }
  }

  // Pool-friendly spawn used by ambient top-up, split, and school.
  private spawnFishAt(x: number, y: number, dir: number, type: string): Fish {
    let f = this.fish.getFirstDead(false) as Fish | null;
    if (!f) { f = spawnEmoji(this, x, y, type); this.fish.add(f); }
    else { this.tweens.killTweensOf(f); resetEmoji(f, type, x, y); }
    f.setScale(ITEM_SCALE).setAlpha(1).setAngle(0).clearTint().setActive(true).setVisible(true);
    f.setData("type", type);
    f.setData("dir", dir);
    f.setData("speedX", DRIFT_MIN + Math.random() * (DRIFT_MAX - DRIFT_MIN));
    f.setData("baseY", y);
    f.setData("bobAmp", 10 + Math.random() * 20);
    f.setData("bobFreq", 0.6 + Math.random() * 0.8);
    f.setData("bobPhase", Math.random() * Math.PI * 2);
    f.setData("taps", 0);
    f.setData("lastTapT", 0);
    f.setData("napUntil", 0);
    f.setData("zzz", null);
    return f;
  }

  // Short-lived rising "bubbles" as Arc GameObjects (no texture -> no Phaser-4
  // generateTexture gotcha). Halved under reduced-motion.
  private emitBubbles(x: number, y: number, count: number, spread: number) {
    const n = this.reduceMotion ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i++) {
      const bx = x + (Math.random() * 2 - 1) * spread;
      const r = 4 + Math.random() * 8;
      const b = this.add.circle(bx, y, r, 0xffffff, 0.5).setDepth(55);
      b.setStrokeStyle(2, 0xffffff, 0.8);
      this.tweens.add({
        targets: b, y: y - (70 + Math.random() * 80), alpha: 0,
        duration: 700 + Math.random() * 500, ease: "Sine.out", onComplete: () => b.destroy(),
      });
    }
  }

  private tryTap(px: number, py: number) {
    const actives = (this.fish.getChildren() as Fish[]).filter((f) => f.active);
    if (!actives.length) return;
    const idx = pickNearestWithinRadius(px, py, actives.map((f) => ({ x: f.x, y: f.y })), TAP_RADIUS);
    if (idx < 0) return;
    const fish = actives[idx];
    const now = this._t;

    // Napping fish only mumble — no big reaction.
    if ((fish.getData("napUntil") as number) > now) { this.sleepyMumble(fish); return; }

    // Per-fish frenzy accounting -> nap.
    let taps = fish.getData("taps") as number;
    const lastTapT = fish.getData("lastTapT") as number;
    if (now - lastTapT > TAP_WINDOW) taps = 0;
    taps += 1;
    fish.setData("taps", taps);
    fish.setData("lastTapT", now);
    if (taps >= NAP_TAPS) { this.startNap(fish, now); return; }

    // Pick + apply a surprise.
    const atCap = this.fish.countActive(true) >= HARD_CAP;
    const res = pickReaction(this.aqState, Math.random, { atCap });
    this.aqState = res.state;
    this.applyReaction(fish, res.reaction);
  }

  private applyReaction(fish: Fish, reaction: Reaction) {
    // A fresh tap interrupts any in-flight reaction cleanly: kill the prior
    // reaction tweens and restore the fish to its base angle/scale/tint, so an
    // interrupted spin/squash/colorflash/giant can't leave it stuck rotated,
    // resized, or tinted. (update() controls x/y drift separately — not tweened.)
    this.tweens.killTweensOf(fish);
    fish.setAngle(0).setScale(ITEM_SCALE).clearTint();
    switch (reaction.id) {
      case "spin": this.rSpin(fish); break;
      case "wiggle": this.rWiggle(fish); break;
      case "bubble": this.rBubble(fish); break;
      case "squash": this.rSquash(fish); break;
      case "colorflash": this.rColorFlash(fish); break;
      case "heart": this.rHeart(fish); break;
      // Uncommon + Rare reactions are added in Tasks 6 & 7. Until then they fall
      // through to a gentle wiggle (always a pleasant, unbreakable response).
      default: this.rWiggle(fish); break;
    }
  }

  // --- Common reaction handlers ---
  private rSpin(fish: Fish) {
    this.tweens.add({ targets: fish, angle: fish.angle + 360, duration: 500, ease: "Cubic.out", onComplete: () => fish.setAngle(0) });
    this.sound.play("blub", { volume: 0.4, detune: Phaser.Math.Between(-100, 100) });
  }
  private rWiggle(fish: Fish) {
    const a = fish.angle;
    this.tweens.add({ targets: fish, angle: a + 14, yoyo: true, repeat: 3, duration: 70, onComplete: () => fish.setAngle(0) });
  }
  private rBubble(fish: Fish) {
    this.emitBubbles(fish.x, fish.y - 10, 6, 26);
    this.sound.play("blub", { volume: 0.5, detune: Phaser.Math.Between(-150, 150) });
  }
  private rSquash(fish: Fish) {
    this.tweens.add({
      targets: fish, scaleX: ITEM_SCALE * 1.3, scaleY: ITEM_SCALE * 0.7, yoyo: true,
      duration: 140, ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE),
    });
  }
  private rColorFlash(fish: Fish) {
    const cols = RAINBOW_COLORS;
    this.tweens.addCounter({
      from: 0, to: cols.length, duration: 600,
      onUpdate: (tw) => { if (fish.active) fish.setTint(cols[Math.floor(tw.getValue() ?? 0) % cols.length]); },
      onComplete: () => { if (fish.active) fish.clearTint(); },
    });
  }
  private rHeart(fish: Fish) {
    const h = spawnEmoji(this, fish.x, fish.y, "heart").setScale(0.4).setDepth(60);
    this.tweens.add({ targets: h, y: h.y - 90, alpha: 0, duration: 700, ease: "Sine.out", onComplete: () => h.destroy() });
  }

  // --- Sleepy damper ---
  private sleepyMumble(fish: Fish) {
    this.tweens.add({ targets: fish, angle: fish.angle + 6, yoyo: true, duration: 120, repeat: 1 });
  }
  private startNap(fish: Fish, now: number) {
    fish.setData("napUntil", now + NAP_SECONDS);
    fish.setData("taps", 0);
    fish.setTint(0x99aabb);
    const zzz = this.add.text(fish.x, fish.y - 50, "💤", { fontSize: "40px" }).setOrigin(0.5).setDepth(60);
    fish.setData("zzz", zzz);
    this.tweens.add({ targets: fish, angle: 12, duration: 300 });
  }
  private wake(fish: Fish) {
    fish.setData("napUntil", 0);
    fish.clearTint();
    const z = fish.getData("zzz") as Phaser.GameObjects.Text | null;
    if (z) { z.destroy(); fish.setData("zzz", null); }
    this.tweens.killTweensOf(fish);
    fish.setAngle(0);
    this.tweens.add({ targets: fish, scale: ITEM_SCALE * 1.2, yoyo: true, duration: 160, onComplete: () => fish.setScale(ITEM_SCALE) });
    this.fx.popAt(fish.x, fish.y);
  }

  private recycle(fish: Fish) {
    this.tweens.killTweensOf(fish);
    const z = fish.getData("zzz") as Phaser.GameObjects.Text | null;
    if (z) { z.destroy(); fish.setData("zzz", null); }
    this.fish.killAndHide(fish);
    fish.setActive(false);
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this._t += dt;
    this.bg.update(dt, this.scale.width);
    const W = this.scale.width, H = this.scale.height;

    // Ambient top-up toward the baseline.
    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL) {
      this.spawnTimer = 0;
      const active = this.fish.countActive(true);
      if (active < BASELINE && active < HARD_CAP) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const x = dir > 0 ? -50 : W + 50;
        const y = 150 + Math.random() * (H - 320);
        this.spawnFishAt(x, y, dir, AQUARIUM_TYPES[Math.floor(Math.random() * AQUARIUM_TYPES.length)]);
      }
    }

    // Drift + bob; wake nappers; recycle off-screen fish.
    (this.fish.getChildren() as Fish[]).forEach((f) => {
      if (!f.active) return;
      const napping = (f.getData("napUntil") as number) > this._t;
      if (!napping && (f.getData("napUntil") as number) > 0) this.wake(f);

      const dir = f.getData("dir") as number;
      const speed = (f.getData("speedX") as number) * (napping ? NAP_SLOW : 1);
      f.x += dir * speed * dt;
      const baseY = f.getData("baseY") as number;
      f.y = baseY + Math.sin(this._t * (f.getData("bobFreq") as number) + (f.getData("bobPhase") as number)) * (f.getData("bobAmp") as number);

      // Move the 💤 with its fish.
      const z = f.getData("zzz") as Phaser.GameObjects.Text | null;
      if (z) z.setPosition(f.x, f.y - 50);

      if ((dir > 0 && f.x > W + 60) || (dir < 0 && f.x < -60)) this.recycle(f);
    });
  }
}
