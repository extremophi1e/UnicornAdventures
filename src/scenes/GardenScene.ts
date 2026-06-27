import Phaser from "phaser";
import { GardenBackground } from "./ui/GardenBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { Sound, GARDEN_MUSIC_KEYS } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { pickTier, plantForTier, unlockedTier, isFull, type Tier } from "../core/garden";

const GROW_MS = 700;          // sprout -> full-size grow
const SWAP_AT = 420;          // ms into the grow when 🌱 becomes the final plant
const TIER_SCALE = [0.42, 0.62, 0.95]; // base setScale per tier (144px frames)
const FX_DEPTH = 100000;      // sparkles/unicorn always in front

export class GardenScene extends Phaser.Scene {
  private bg!: GardenBackground;
  private sound2!: Sound;
  private fx!: Celebrations; // used in Task 6 (bloom celebrations)
  private plants!: Phaser.GameObjects.Group;
  private creatures!: Phaser.GameObjects.Group; // used in Task 5 (pollinators)
  private placed = 0;
  private lastTier = 0;
  private phase: "building" | "celebrating" | "clearing" = "building";
  private noteIndex = 0;
  private reduce = false;

  constructor() { super("Garden"); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.bg = new GardenBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.sound2.playMusic(GARDEN_MUSIC_KEYS, 0.3); // quiet ambient bed; tap-notes are the foreground
    this.fx = new Celebrations(this);

    this.placed = 0; this.lastTier = 0; this.phase = "building"; this.noteIndex = 0;
    this.plants = this.add.group();
    this.creatures = this.add.group(); // populated in Task 5
    void this.fx;       // used in Task 6 (bloom); suppress noUnusedLocals
    void this.creatures; // used in Task 5 (pollinators); suppress noUnusedLocals

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
    const tier = pickTier(this.placed, Math.random) as Tier;
    const key = plantForTier(tier, Math.random);
    const H = this.scale.height;
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

  // Called when a plant finishes growing: sparkle + note + ladder cue. (Task 5 adds
  // the pollinator release; Task 6 adds the bloom trigger.)
  private finishPlant(c: Phaser.GameObjects.Sprite, _tier: Tier) {
    this.placed += 1;
    this.sparkle(c.x, c.y - 40 * (c.scaleY || 1) * 1.4, this.reduce ? 3 : 8);
    this.sound2.note(this.noteIndex++);
    this.bg.setWarmth(this.placed / 22);

    // Ladder-unlock chord cue when a new tier first appears.
    const top = unlockedTier(this.placed);
    if (top > this.lastTier) { this.lastTier = top; this.sound2.note(this.noteIndex + 2); this.sound2.fanfare(); }

    if (isFull(this.placed)) { /* Task 6: this.bloom(); */ }
  }

  private teardownAll() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.sound.stopAll();
  }

  update(_t: number, dms: number) {
    this.bg.update(dms / 1000);
  }
}
