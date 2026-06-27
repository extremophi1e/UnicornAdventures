import Phaser from "phaser";
import { EggsBackground } from "./ui/EggsBackground";
import { resetEmoji } from "../render/emojiSprite";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM } from "../render/catchUnicorn";
import { Sound } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { createBag, JACKPOT, type Bag } from "../core/gumballs";
import { pickNearestWithinRadius } from "../core/pop";
import { nextStage, type Stage } from "../core/eggs";
import { EMOJI } from "../render/emoji";

const EGG_RX = 46, EGG_RY = 60;
const EGG_HIT_RADIUS = 100;
const WOBBLE_DEG = 5, WOBBLE_MS = 550;
const WEB_FLASH_MS = 80;
const REVEAL_HOLD_MS = 2500;
const BURST_PARTICLES = 14;
const ITEM_REVEAL_SCALE = (2.2 / 2) * 1.3;   // 144px emoji frames (/2), shown 30% larger
const JACKPOT_REVEAL_SCALE = 0.85 * 1.3;     // catchUnicorn 256px sheet

// Soft pastel shells (fill + outline/speckle). The golden egg uses GOLD.
const EGG_COLORS = [
  { fill: 0xffd1dc, line: 0xe79bb0 }, // pink
  { fill: 0xbde0fe, line: 0x8bbbe0 }, // sky
  { fill: 0xfff3b0, line: 0xe6d77a }, // butter
  { fill: 0xc8f7d4, line: 0x90d6a6 }, // mint
  { fill: 0xe6dcff, line: 0xb9a7e6 }, // lavender
  { fill: 0xffd8be, line: 0xe6b194 }, // peach
];
const GOLD = { fill: 0xf5c542, line: 0xb8860b };

interface EggView {
  x: number; y: number;                         // nest-slot anchor
  container: Phaser.GameObjects.Container;
  shell: Phaser.GameObjects.Graphics;
  cracks: Phaser.GameObjects.Graphics;
  stage: Stage;
  contents: string;                             // animal key or JACKPOT
  golden: boolean;
  active: boolean;                              // tappable? (false during drop/reveal/refill)
  wobble?: Phaser.Tweens.Tween;
  breathe?: Phaser.Tweens.Tween;
  sparkle?: Phaser.Time.TimerEvent;
}

export class EggsScene extends Phaser.Scene {
  private bg!: EggsBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bag!: Bag;
  private reduceMotion = false;
  private eggs: EggView[] = [];
  private reveals!: Phaser.GameObjects.Group;   // pooled revealed-animal sprites
  private glow!: Phaser.GameObjects.Rectangle;

  constructor() { super("Eggs"); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.reduceMotion = (typeof window !== "undefined" && window.matchMedia)
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

    this.bg = new EggsBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.fx = new Celebrations(this);
    this.bag = createBag(Math.random, Object.keys(EMOJI)); // one shared bag (global no-repeat + jackpot gate)
    this.eggs = [];

    // One pooled shatter/celebration burst (sparkle frame), shards fall via gravity.
    this.burst = this.add.particles(0, 0, ATLAS_KEY, {
      frame: frameFor("sparkle"), speed: { min: 140, max: 340 }, angle: { min: 0, max: 360 },
      gravityY: 420, scale: { start: 0.7, end: 0 }, alpha: { start: 1, end: 0 },
      lifespan: 600, quantity: 1, emitting: false,
    }).setDepth(60);

    this.glow = this.add.rectangle(W / 2, H / 2, W, H, 0xff7fbf, 0).setDepth(55);
    this.reveals = this.add.group();

    // Four nest slots in a gentle 2x2 cluster around the nest centre (W/2, H*0.62).
    const cx = W / 2, nestY = H * 0.62;
    const dx = Math.min(0.20 * W, 150);
    const anchors = [
      { x: cx - dx, y: nestY - 58 }, { x: cx + dx, y: nestY - 58 },
      { x: cx - dx * 1.05, y: nestY + 64 }, { x: cx + dx * 1.05, y: nestY + 64 },
    ];
    anchors.forEach((a) => this.eggs.push(this.makeEgg(a.x, a.y)));
    this.eggs.forEach((e, i) => this.time.delayedCall(120 * i, () => this.fillEgg(e))); // staggered drop-in

    // Multi-touch: up to 4 fingers; each pointer-down taps the nearest tappable egg.
    this.input.addPointer(3);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onTap(p.worldX, p.worldY));

    // Dedicated looping music, robust autoplay, stopped on shutdown.
    const music = this.sound.add("eggsmusic", { loop: true, volume: 0.38 });
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

  private makeEgg(x: number, y: number): EggView {
    const shell = this.add.graphics();
    const cracks = this.add.graphics();
    const container = this.add.container(x, y, [shell, cracks]).setDepth(20).setVisible(false);
    return { x, y, container, shell, cracks, stage: "intact", contents: "cat", golden: false, active: false };
  }

  // (Re)fill a slot with a fresh egg that drops in from above.
  private fillEgg(e: EggView) {
    e.contents = this.bag.next();
    e.golden = e.contents === JACKPOT;
    const pal = e.golden ? GOLD : EGG_COLORS[Math.floor(Math.random() * EGG_COLORS.length)];
    e.stage = "intact";
    this.drawEgg(e.shell, pal.fill, pal.line, e.golden);
    e.cracks.clear();
    this.killEggTweens(e);
    e.container.setScale(1).setAngle(0).setAlpha(1).setVisible(true).setPosition(e.x, e.y - 240);
    this.tweens.add({
      targets: e.container, y: e.y, duration: 520, ease: "Bounce.easeOut",
      onComplete: () => { e.active = true; this.startIdle(e); },
    });
  }

  // Wobble (the "tell"), plus a gentle breathe + sparkle for golden eggs.
  private startIdle(e: EggView) {
    if (this.reduceMotion) return;
    e.wobble = this.tweens.add({
      targets: e.container, angle: { from: -WOBBLE_DEG, to: WOBBLE_DEG },
      duration: WOBBLE_MS, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * WOBBLE_MS,
    });
    if (e.golden) {
      e.breathe = this.tweens.add({
        targets: e.container, scale: { from: 1, to: 1.06 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
      e.sparkle = this.time.addEvent({ delay: 700, loop: true, callback: () => { if (e.active) this.twinkle(e.x, e.y - 14); } });
    }
  }

  private twinkle(x: number, y: number) {
    const s = this.add.image(x + (Math.random() * 30 - 15), y, ATLAS_KEY, frameFor("sparkle")).setScale(0.5).setDepth(30);
    this.tweens.add({ targets: s, scale: 0, alpha: 0, duration: 500, onComplete: () => s.destroy() });
  }

  private killEggTweens(e: EggView) {
    e.wobble?.stop(); e.wobble = undefined;
    e.breathe?.stop(); e.breathe = undefined;
    e.sparkle?.remove(false); e.sparkle = undefined;
    this.tweens.killTweensOf(e.container);
  }

  private onTap(px: number, py: number) {
    const tappable = this.eggs.filter((e) => e.active && e.stage !== "burst");
    if (!tappable.length) return;
    const idx = pickNearestWithinRadius(px, py, tappable.map((e) => ({ x: e.x, y: e.y })), EGG_HIT_RADIUS);
    if (idx < 0) return;
    this.tapEgg(tappable[idx]);
  }

  private tapEgg(e: EggView) {
    e.stage = nextStage(e.stage);
    if (e.stage === "burst") {
      e.active = false;
      this.sound2.crack(3);
      this.drawCracks(e.cracks, "burst");      // flash the full web...
      this.killEggTweens(e);
      e.container.setAngle(0).setScale(1);
      this.time.delayedCall(WEB_FLASH_MS, () => this.hatch(e)); // ...then shatter
    } else {
      // Squish feedback on the non-final taps (the burst tap's feedback is the shatter).
      this.tweens.add({ targets: e.container, scaleX: 1.12, scaleY: 0.9, duration: 90, yoyo: true, ease: "Sine.easeInOut" });
      this.sound2.crack(e.stage === "crack1" ? 1 : 2);
      this.drawCracks(e.cracks, e.stage);
    }
  }

  private hatch(e: EggView) {
    const jackpot = e.contents === JACKPOT;
    this.sound2.shatter();
    if (this.reduceMotion) {
      // Calm path (prefers-reduced-motion): quietly fade the shell out — no flying shards.
      this.tweens.add({ targets: e.container, alpha: 0, duration: 200, onComplete: () => e.container.setVisible(false).setAlpha(1) });
    } else {
      e.container.setVisible(false);
      this.burst.explode(BURST_PARTICLES, e.x, e.y);
    }
    const spr = this.showReveal(e, jackpot);
    const finalScale = jackpot ? JACKPOT_REVEAL_SCALE : ITEM_REVEAL_SCALE;
    this.tweens.add({ targets: spr, y: e.y - 30, duration: 420, ease: "Sine.easeOut" });
    this.tweens.add({ targets: spr, scale: finalScale, duration: 420, ease: "Back.easeOut", onComplete: () => this.payoff(e, jackpot, spr) });
  }

  private showReveal(e: EggView, jackpot: boolean): Phaser.GameObjects.Sprite {
    let s = this.reveals.getFirstDead(false) as Phaser.GameObjects.Sprite | null;
    if (!s) {
      s = this.add.sprite(e.x, e.y, jackpot ? CATCH_UNICORN_KEY : EMOJI[e.contents].key).setDepth(50);
      this.reveals.add(s);
    }
    this.tweens.killTweensOf(s);
    s.setPosition(e.x, e.y).setActive(true).setVisible(true).setAlpha(1).setAngle(0).clearTint();
    if (jackpot) s.play(CATCH_UNICORN_ANIM);
    else resetEmoji(s, e.contents, e.x, e.y);
    s.setScale(0);
    return s;
  }

  private payoff(e: EggView, jackpot: boolean, spr: Phaser.GameObjects.Sprite) {
    if (jackpot) {
      if (this.reduceMotion) this.fx.banner("🌈");
      else {
        this.fx.bigParty(); this.fx.banner("🌈");
        this.tweens.add({ targets: this.glow, alpha: { from: 0, to: 0.22 }, duration: 350, yoyo: true, hold: 250 });
      }
      this.sound2.tada();
    } else {
      if (this.reduceMotion) this.fx.popAt(spr.x, spr.y);
      else { this.fx.bigParty(); this.fx.popAt(spr.x, spr.y); }
      this.sound2.fanfare();
    }
    // Linger, then fade the animal out and drop a fresh egg into the slot.
    this.time.delayedCall(REVEAL_HOLD_MS, () => {
      this.tweens.add({
        targets: spr, alpha: 0, scale: spr.scale * 0.8, duration: 250,
        onComplete: () => { this.reveals.killAndHide(spr); spr.setScale(1).setAlpha(1); },
      });
      this.fillEgg(e);
    });
  }

  // ---- drawing helpers ----
  private drawEgg(g: Phaser.GameObjects.Graphics, fill: number, line: number, golden: boolean) {
    g.clear();
    const steps = 48;
    g.fillStyle(fill, 1);
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      const cxp = Math.sin(th), cyp = -Math.cos(th);   // -1 (top) .. +1 (bottom)
      const w = EGG_RX * (1 + 0.16 * cyp);             // narrower at the top
      const x = cxp * w, y = cyp * EGG_RY;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fillPath();
    g.lineStyle(3, line, 1); g.strokePath();
    g.fillStyle(0xffffff, golden ? 0.4 : 0.28);
    g.fillEllipse(-EGG_RX * 0.32, -EGG_RY * 0.34, EGG_RX * 0.5, EGG_RY * 0.42); // glossy highlight
    if (!golden) {
      g.fillStyle(line, 0.5);
      for (const [sx, sy] of [[-12, 6], [10, 22], [-6, 30], [16, -8], [-18, 18]]) g.fillCircle(sx, sy, 2.5);
    }
  }

  private drawCracks(g: Phaser.GameObjects.Graphics, stage: Stage) {
    g.clear();
    if (stage === "intact") return;
    g.lineStyle(3, 0x5a4632, 1);
    const seam = (pts: number[][]) => {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.strokePath();
    };
    seam([[-2, -EGG_RY * 0.7], [6, -EGG_RY * 0.3], [-4, 0], [7, EGG_RY * 0.25]]);   // crack1: main seam
    if (stage === "crack1") return;
    seam([[6, -EGG_RY * 0.3], [22, -EGG_RY * 0.18], [30, 2]]);                       // crack2: + branch
    if (stage === "crack2") return;
    seam([[-4, 0], [-20, 8], [-28, -6]]);                                            // burst: full web
    seam([[7, EGG_RY * 0.25], [18, EGG_RY * 0.45], [4, EGG_RY * 0.6]]);
  }

  update(_t: number, dms: number) {
    this.bg.update(dms / 1000, this.scale.width);
  }
}
