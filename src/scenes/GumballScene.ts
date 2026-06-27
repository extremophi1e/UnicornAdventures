import Phaser from "phaser";
import { PlayroomBackground } from "./ui/PlayroomBackground";
import { resetEmoji } from "../render/emojiSprite";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM } from "../render/catchUnicorn";
import { Sound } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { createBag, JACKPOT, type Bag } from "../core/gumballs";

const ANTICIPATION_MS = 1100;        // rattle + flash before the reveal
const FLASH_INTERVAL_MS = 260;       // toggle every 260ms -> ~1.9 flashes/sec (seizure-safe)
const BURST_PARTICLES = 16;
const BURST_PARTICLES_REDUCED = 5;
const ITEM_REVEAL_SCALE = 2.2;       // emoji frame is 72px
const JACKPOT_REVEAL_SCALE = 0.85;   // catchUnicorn frame is 256px
// Flashing bulbs avoid saturated red (photosensitivity); soft coral replaces it.
const BULB_COLORS = [0xff7f7f, 0xff9500, 0xffcc00, 0x34c759, 0x00a3ff, 0x5e5ce6, 0xaf52de];
const BULB_DIM = 0xcfd8e0;

export class GumballScene extends Phaser.Scene {
  private bg!: PlayroomBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bag!: Bag;
  private reduceMotion = false;
  private busy = false;

  private machine!: Phaser.GameObjects.Container;
  private machineBaseX = 0;
  private bulbs: Phaser.GameObjects.Arc[] = [];
  private bulbsLit = false;
  private button!: Phaser.GameObjects.Container;
  private wiggle?: Phaser.Tweens.Tween;
  private rattle?: Phaser.Tweens.Tween;
  private flashEvent?: Phaser.Time.TimerEvent;
  private glow!: Phaser.GameObjects.Rectangle;

  private chuteX = 0;
  private chuteY = 0;
  private revealY = 0;
  private item!: Phaser.GameObjects.Sprite;          // pooled revealed cutie (one at a time)
  private jackpotSprite!: Phaser.GameObjects.Sprite; // the unicorn for jackpots

  constructor() { super("Gumball"); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.reduceMotion = (typeof window !== "undefined" && window.matchMedia)
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

    this.bg = new PlayroomBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.fx = new Celebrations(this);
    this.bag = createBag(Math.random);
    this.busy = false;

    this.burst = this.add.particles(0, 0, ATLAS_KEY, {
      frame: frameFor("sparkle"), speed: { min: 140, max: 320 }, angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 500, quantity: 1, emitting: false,
    }).setDepth(60);

    this.glow = this.add.rectangle(W / 2, H / 2, W, H, 0xff7fbf, 0).setDepth(55);

    this.buildMachine(W, H);
    this.buildButton(W, H);

    // Pooled revealed cutie + the jackpot unicorn (both hidden until used).
    this.item = this.add.sprite(this.chuteX, this.chuteY, "emoji-star").setVisible(false).setDepth(50);
    this.jackpotSprite = this.add.sprite(this.chuteX, this.chuteY, CATCH_UNICORN_KEY).setVisible(false).setDepth(50);

    // Dedicated looping music (low volume), robust autoplay, stopped on shutdown.
    const music = this.sound.add("gumball", { loop: true, volume: 0.38 });
    const startMusic = () => { if (!music.isPlaying) music.play(); };
    startMusic();
    this.time.delayedCall(200, startMusic);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    this.input.once("pointerdown", startMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { music.stop(); this.sound.stopAll(); });

    const back = this.add.text(W - 24, 24, "⬅", { fontSize: "44px", color: "#5a3b8c" })
      .setOrigin(1, 0).setDepth(1000).setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("Title"));
  }

  private buildMachine(W: number, H: number) {
    const mx = W / 2, my = H * 0.34;
    this.machineBaseX = mx;
    const c = this.add.container(mx, my).setDepth(10);

    const g = this.add.graphics();
    // Base + foot.
    g.fillStyle(0xdfe6ee, 1).fillRoundedRect(-120, 90, 240, 150, 24);
    g.fillStyle(0xb9c4d0, 1).fillRoundedRect(-140, 230, 280, 26, 12);
    // Chute opening.
    g.fillStyle(0x3a3f47, 1).fillRoundedRect(-44, 150, 88, 44, 10);
    // Solid red globe — opaque (nothing visible inside), a darker rim, and a soft
    // glossy highlight so it reads as a candy-red glass dome.
    g.fillStyle(0xe23b3b, 1).fillCircle(0, -30, 150);
    g.lineStyle(8, 0xb52d2d, 1).strokeCircle(0, -30, 150);
    g.fillStyle(0xffffff, 0.22).fillCircle(-52, -88, 52);
    c.add(g);

    // Bulbs around the globe.
    for (let i = 0; i < 6; i++) {
      const ang = -Math.PI * 0.85 + (i / 5) * (Math.PI * 1.7);
      const b = this.add.circle(Math.cos(ang) * 168, -30 + Math.sin(ang) * 168, 13, BULB_DIM, 1);
      this.bulbs.push(b);
      c.add(b);
    }

    this.machine = c;
    this.chuteX = mx;
    this.chuteY = my + 172;
    this.revealY = my + 300;
  }

  private buildButton(W: number, H: number) {
    const bx = W / 2, by = H * 0.80, r = 120;
    const g = this.add.graphics();
    g.fillStyle(0xff5fa2, 1).fillCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.25).fillCircle(0, -r * 0.32, r * 0.55);
    const label = this.add.text(0, 0, "👆", { fontSize: "84px" }).setOrigin(0.5);
    this.button = this.add.container(bx, by, [g, label]).setDepth(40);
    // Generous rectangular hit area via a separate zone (reliable for containers).
    const zone = this.add.zone(bx, by, (r + 30) * 2, (r + 30) * 2).setDepth(40).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.pull());
  }

  private pull() {
    if (this.busy) return;
    this.busy = true;
    this.sound2.pop();
    // Button squash, then a continuous wiggle while locked so it never looks frozen.
    this.tweens.add({ targets: this.button, scaleX: 1.12, scaleY: 0.9, duration: 90, yoyo: true, ease: "Sine.inOut" });
    this.wiggle = this.tweens.add({ targets: this.button, angle: { from: -4, to: 4 }, duration: 140, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    if (this.reduceMotion) {
      // Gentle single glow-pulse instead of rattle/flash.
      this.tweens.add({ targets: this.glow, alpha: { from: 0, to: 0.12 }, duration: 300, yoyo: true });
      this.time.delayedCall(500, () => this.reveal());
    } else {
      this.rattle = this.tweens.add({
        targets: this.machine, x: this.machineBaseX + 10, duration: 60, yoyo: true,
        repeat: Math.floor(ANTICIPATION_MS / 120), ease: "Sine.inOut",
      });
      this.flashEvent = this.time.addEvent({
        delay: FLASH_INTERVAL_MS, repeat: Math.floor(ANTICIPATION_MS / FLASH_INTERVAL_MS),
        callback: () => this.toggleBulbs(),
      });
      this.time.delayedCall(ANTICIPATION_MS, () => this.reveal());
    }
  }

  private toggleBulbs() {
    this.bulbsLit = !this.bulbsLit;
    this.bulbs.forEach((b, i) => b.setFillStyle(this.bulbsLit ? BULB_COLORS[i % BULB_COLORS.length] : BULB_DIM, 1));
  }

  private reveal() {
    this.flashEvent?.remove(false);
    this.flashEvent = undefined;
    this.rattle?.stop(); this.rattle = undefined;
    this.machine.x = this.machineBaseX;
    this.bulbsLit = false; this.bulbs.forEach((b) => b.setFillStyle(BULB_DIM, 1));

    const id = this.bag.next();
    const jackpot = id === JACKPOT;
    const spr = jackpot ? this.jackpotSprite : this.item;
    this.tweens.killTweensOf(this.item);
    this.tweens.killTweensOf(this.jackpotSprite);

    if (jackpot) {
      this.item.setVisible(false);
      spr.setPosition(this.chuteX, this.chuteY).setScale(0).setAlpha(1).setVisible(true).play(CATCH_UNICORN_ANIM);
    } else {
      this.jackpotSprite.setVisible(false);
      resetEmoji(spr, id, this.chuteX, this.chuteY);
      spr.setScale(0).setAlpha(1).setVisible(true);
    }

    const finalScale = jackpot ? JACKPOT_REVEAL_SCALE : ITEM_REVEAL_SCALE;
    this.tweens.add({ targets: spr, y: this.revealY, duration: 480, ease: "Bounce.easeOut" });
    this.tweens.add({
      targets: spr, scale: finalScale, duration: 480, ease: "Back.easeOut",
      onComplete: () => this.payoff(jackpot, spr),
    });
  }

  private payoff(jackpot: boolean, spr: Phaser.GameObjects.Sprite) {
    const x = spr.x, y = spr.y;
    this.burst.explode(this.reduceMotion ? BURST_PARTICLES_REDUCED : BURST_PARTICLES, x, y);
    if (jackpot) {
      this.fx.bigParty();
      this.fx.banner("🌈");
      this.sound2.tada();
      if (!this.reduceMotion) this.tweens.add({ targets: this.glow, alpha: { from: 0, to: 0.22 }, duration: 350, yoyo: true, hold: 250 });
    } else {
      this.fx.bigParty();
      this.fx.popAt(x, y);
      this.sound2.fanfare();
    }
    // Show the revealed item for 3s, then fade it out and unlock for the next pull.
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: spr, alpha: 0, duration: 250,
        onComplete: () => { spr.setVisible(false); spr.setAlpha(1); },
      });
      this.wiggle?.stop(); this.wiggle = undefined;
      this.button.setAngle(0);
      this.busy = false;
    });
  }

  update(_t: number, dms: number) {
    this.bg.update(dms / 1000, this.scale.width);
  }
}
