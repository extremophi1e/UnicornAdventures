import Phaser from "phaser";
import { GardenBackground } from "./ui/GardenBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { Sound, GARDEN_MUSIC_KEYS } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { pickTier, plantForTier, unlockedTier, isFull, shouldRelease, spreadPosition, BLOOM_TARGET, TIER_PLANTS, type Tier } from "../core/garden";
import { EMOJI } from "../render/emoji";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM } from "../render/catchUnicorn";
import { loadAtlas, loadEmoji, loadAudio, registerEmojiAnims, showLoadingBar, preloadFirstTrack } from "../render/assets";

const LINGER = 2;           // creatures kept across the reset (continuity, not erasure)
const CLEAR_STAGGER = 45;   // ms between each plant wilting
const GROW_MS = 700;          // sprout -> full-size grow
const SWAP_AT = 420;          // ms into the grow when 🌱 becomes the final plant
const TIER_SCALE = [0.63, 0.93, 1.425]; // base setScale per tier (144px frames) — 50% larger
const FX_DEPTH = 100000;      // sparkles/unicorn always in front
const PLANT_MIN_GAP = 70;     // min spacing between plant centers so taps don't stack
const CREATURE_CAP = 5;
// 🐝 bee only if it baked loop-safe in Task 1; else 🍩 donut is the 2nd flyer.
const CREATURE_KEYS = ["butterfly", EMOJI["bee"] ? "bee" : "donut"];
const CREATURE_SCALE = 0.5;   // 144px frames
// Every emoji this mode can spawn: the 🌱 sprout, all maturity-ladder plants, and the
// pollinators. Lazy-loaded on first entry.
const GARDEN_EMOJI_KEYS = ["sprout", ...TIER_PLANTS.flat(), ...CREATURE_KEYS];

export class GardenScene extends Phaser.Scene {
  private bg!: GardenBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private plants!: Phaser.GameObjects.Group;
  private creatures!: Phaser.GameObjects.Group;
  private placed = 0;
  private lastTier = 0;
  private phase: "building" | "celebrating" | "clearing" = "building";
  private noteIndex = 0;
  private reduce = false;

  constructor() { super("Garden"); }

  preload() {
    loadAtlas(this);
    loadEmoji(this, GARDEN_EMOJI_KEYS);
    loadAudio(this, ["gardennotes", "fanfare", "tada"]);
    preloadFirstTrack(this, GARDEN_MUSIC_KEYS);
    showLoadingBar(this);
  }

  create() {
    registerEmojiAnims(this, GARDEN_EMOJI_KEYS);
    const W = this.scale.width, H = this.scale.height;
    this.reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.bg = new GardenBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.sound2.playMusic(GARDEN_MUSIC_KEYS, 0.3); // quiet ambient bed; tap-notes are the foreground
    this.fx = new Celebrations(this);

    this.placed = 0; this.lastTier = 0; this.phase = "building"; this.noteIndex = 0;
    this.plants = this.add.group();
    this.creatures = this.add.group();

    this.add.text(W - 24, 24, "⬅", { fontSize: "44px" }).setOrigin(1, 0).setDepth(FX_DEPTH)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("Title"));

    this.input.addPointer(3); // a couple of kids can tap at once
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onTap(p.x, p.y));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownAll());
  }

  private onTap(x: number, y: number) {
    if (this.phase !== "building") return;          // ignore taps mid-celebration/clear
    if (x > this.scale.width - 90 && y < 90) return; // the back button's corner
    if (y < this.bg.horizon) { this.sparkle(x, y); return; } // sky tap = just a sparkle
    this.growPlant(x, y);
  }

  // A small high-depth sparkle burst (in front of the meadow), like Celebrations.popAt.
  private sparkle(x: number, y: number, n = 8) {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, ATLAS_KEY, frameFor("sparkle")).setScale(0.6).setDepth(FX_DEPTH);
      const ang = (Math.PI * 2 * i) / n;
      this.tweens.add({ targets: s, x: x + Math.cos(ang) * 55, y: y + Math.sin(ang) * 55, alpha: 0, duration: 380, onComplete: () => s.destroy() });
    }
  }

  private growPlant(x: number, y: number) {
    const H = this.scale.height, W = this.scale.width;
    // Don't stack plants: if this lands on a crowd, nudge it to a nearby free spot
    // (keeps it near the finger but fanned out), clamped to the meadow band.
    const existing = (this.plants.getChildren() as Phaser.GameObjects.Sprite[])
      .filter((p) => p.active)
      .map((p) => ({ x: p.x, y: p.y }));
    const pos = spreadPosition(x, y, existing, PLANT_MIN_GAP,
      { minX: 36, maxX: W - 36, minY: this.bg.horizon + 12, maxY: H - 24 }, Math.random);
    x = pos.x; y = pos.y;

    const tier = pickTier(this.placed, Math.random) as Tier;
    const key = plantForTier(tier, Math.random);
    // Nearer (lower) plants are bigger; y also drives draw order.
    const depthFactor = 0.7 + 0.45 * ((y - this.bg.horizon) / (H - this.bg.horizon));
    const target = TIER_SCALE[tier] * depthFactor;

    let c = this.plants.getFirstDead(false) as Phaser.GameObjects.Sprite | null;
    if (!c) { c = spawnEmoji(this, x, y, "sprout"); this.plants.add(c); }
    else { this.tweens.killTweensOf(c); resetEmoji(c, "sprout", x, y); }
    c.setOrigin(0.5, 1).setDepth(Math.round(y)).setAlpha(1).setScale(0);
    c.setData("final", key);

    // Grow with a Back.Out "pop"; swap 🌱 -> final plant partway for a silhouette change.
    this.tweens.add({ targets: c, scale: target, duration: this.reduce ? 240 : GROW_MS, ease: this.reduce ? "Sine.Out" : "Back.Out" });
    this.time.delayedCall(this.reduce ? 0 : SWAP_AT, () => {
      if (c!.active) { resetEmoji(c!, key, c!.x, c!.y); c!.setOrigin(0.5, 1); }
    });
    this.time.delayedCall(this.reduce ? 240 : GROW_MS, () => { if (c!.active) this.finishPlant(c!, tier); });
  }

  // Called when a plant finishes growing: sparkle + note + ladder cue.
  private finishPlant(c: Phaser.GameObjects.Sprite, tier: Tier) {
    if (this.phase !== "building") return;
    this.placed += 1;
    this.sparkle(c.x, c.y - 40 * (c.scaleY || 1) * 1.4, this.reduce ? 3 : 8);
    this.sound2.note(this.noteIndex++);
    this.bg.setWarmth(this.placed / BLOOM_TARGET);

    // Ladder-unlock chord cue when a new tier first appears.
    const top = unlockedTier(this.placed);
    if (top > this.lastTier) { this.lastTier = top; this.sound2.note(this.noteIndex + 2); this.sound2.fanfare(); }

    if (this.creatures.countActive(true) < CREATURE_CAP && shouldRelease(tier, Math.random)) {
      this.releaseCreature(c.x, c.y - 50 * (c.scaleY || 1));
    }
    if (isFull(this.placed)) this.bloom();
  }

  private releaseCreature(x: number, y: number) {
    const key = CREATURE_KEYS[Math.floor(Math.random() * CREATURE_KEYS.length)];
    let c = this.creatures.getFirstDead(false) as Phaser.GameObjects.Sprite | null;
    if (!c) { c = spawnEmoji(this, x, y, key); this.creatures.add(c); }
    else { this.tweens.killTweensOf(c); resetEmoji(c, key, x, y); }
    c.setOrigin(0.5, 0.5).setAlpha(1).setScale(CREATURE_SCALE).setDepth(Math.round(y));
    this.sparkle(x, y, this.reduce ? 2 : 5);
    this.wander(c);
  }

  // Gentle, bounded, recursive drift to a nearby point (no Timeline; animated emoji
  // keeps its own flutter loop). Slower under reduced motion.
  private wander(c: Phaser.GameObjects.Sprite) {
    const W = this.scale.width;
    const nx = Phaser.Math.Clamp(c.x + (Math.random() * 2 - 1) * 180, 40, W - 40);
    const ny = Phaser.Math.Clamp(c.y + (Math.random() * 2 - 1) * 120, 70, this.bg.horizon + 60);
    c.setFlipX(nx < c.x);
    this.tweens.add({
      targets: c, x: nx, y: ny,
      duration: this.reduce ? 5000 : 2200 + Math.random() * 1600,
      ease: "Sine.inOut",
      onComplete: () => { if (c.active) this.wander(c); },
    });
  }

  private updateCreatureDepths() {
    (this.creatures.getChildren() as Phaser.GameObjects.Sprite[]).forEach((c) => {
      if (c.active) c.setDepth(Math.round(c.y));
    });
  }

  // The whole meadow she built celebrates at once, then gently clears.
  private bloom() {
    this.phase = "celebrating";
    const W = this.scale.width, H = this.scale.height;

    // Every plant pops in place + sparkles.
    (this.plants.getChildren() as Phaser.GameObjects.Sprite[]).forEach((p) => {
      if (!p.active) return;
      const base = p.scaleX || 0.5;
      this.tweens.add({ targets: p, scaleX: base * 1.18, scaleY: base * 1.18, duration: this.reduce ? 260 : 220, yoyo: true, ease: this.reduce ? "Sine.inOut" : "Elastic.Out" });
      this.sparkle(p.x, p.y - 40 * (p.scaleY || 1), this.reduce ? 2 : 6);
    });

    if (this.reduce) { this.fx.bigPartyNoShake(); } else { this.fx.bigParty(); }
    this.fx.banner("🌈");
    this.sound2.fanfare();
    this.sound2.tada();

    if (!this.reduce) {
      const uni = this.add.sprite(-140, H * 0.32, CATCH_UNICORN_KEY).setScale(0.5).setDepth(FX_DEPTH).play(CATCH_UNICORN_ANIM);
      this.tweens.add({ targets: uni, x: W + 140, duration: 1700, ease: "Sine.inOut", onComplete: () => uni.destroy() });
    }

    this.time.delayedCall(this.reduce ? 700 : 1400, () => this.clearMeadow());
  }

  // Wilt-fade every plant in a staggered wave; keep a couple of butterflies.
  private clearMeadow() {
    this.phase = "clearing";
    const plants = (this.plants.getChildren() as Phaser.GameObjects.Sprite[]).filter((p) => p.active);
    plants.forEach((p, i) => {
      this.time.delayedCall(this.reduce ? 0 : i * CLEAR_STAGGER, () => {
        this.tweens.killTweensOf(p);
        this.tweens.add({
          targets: p, scale: 0, alpha: 0, duration: this.reduce ? 200 : 320, ease: "Back.In",
          onComplete: () => this.plants.killAndHide(p),
        });
      });
    });

    // Retire all but LINGER creatures (the survivors keep wandering into the next round).
    const creatures = (this.creatures.getChildren() as Phaser.GameObjects.Sprite[]).filter((c) => c.active);
    creatures.slice(LINGER).forEach((c) => {
      this.tweens.killTweensOf(c);
      this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => this.creatures.killAndHide(c) });
    });

    const total = this.reduce ? 400 : plants.length * CLEAR_STAGGER + 400;
    this.time.delayedCall(total, () => this.freshCanvas());
  }

  private freshCanvas() {
    this.placed = 0; this.noteIndex = 0; this.lastTier = 0; this.phase = "building";
    this.bg.setWarmth(0);
    // A soft glow invites the first tap of the new round.
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.image(W / 2, H * 0.78, ATLAS_KEY, frameFor("sparkle")).setScale(1.2).setDepth(FX_DEPTH).setAlpha(0.9);
    this.tweens.add({ targets: g, scale: 1.8, alpha: 0, duration: 900, onComplete: () => g.destroy() });
  }

  private teardownAll() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.sound.stopAll();
  }

  update(_t: number, dms: number) {
    this.bg.update(dms / 1000);
    this.updateCreatureDepths();
  }
}
