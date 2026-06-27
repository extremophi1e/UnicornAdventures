import Phaser from "phaser";
import { AquariumBackground } from "./ui/AquariumBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { Sound } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { pickNearestWithinRadius } from "../core/pop";
import { pickReaction, netAdds, initialAquariumState, pickTreasureReaction, type AquariumState, type Reaction, type TreasureReactionId } from "../core/aquarium";
import { loadAtlas, loadEmoji, loadAudio, registerEmojiAnims, showLoadingBar, ensureAudioLoaded } from "../render/assets";

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

// Floating sea OBJECTS (emoji keys) — tappable "treasures" that drift among the
// creatures but get their own object-only reactions (never split/morph/swim).
const TREASURE_TYPES = ["ringbuoy", "sailboat", "bottle", "ring"];
const TREASURE_CHANCE = 0.2;   // ~1 in 5 ambient spawns is a treasure

// Rainbow tint cycle (ROYGBIV) for color-flash + the shockwave overlay.
const RAINBOW_COLORS = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00a3ff, 0x5e5ce6, 0xaf52de];
// Warm gold tints for the treasure "gleam" reaction.
const GOLD_COLORS = [0xffd700, 0xfff3b0, 0xffe066, 0xffffff, 0xffcf40];

type Fish = Phaser.GameObjects.Sprite;

export class AquariumScene extends Phaser.Scene {
  private bg!: AquariumBackground;
  private sound2!: Sound;
  private fx!: Celebrations;

  private fish!: Phaser.GameObjects.Group;
  private spawnTimer = 0;
  private _t = 0;
  private reduceMotion = false;
  private aqState: AquariumState = initialAquariumState();
  private lastTreasure: TreasureReactionId | null = null;

  constructor() { super("Aquarium"); }

  preload() {
    loadAtlas(this);
    loadEmoji(this, [...AQUARIUM_TYPES, ...TREASURE_TYPES]);
    loadAudio(this, ["aquarium", "blub", "sproing", "chime", "fanfare", "tada"]);
    showLoadingBar(this);
  }

  create() {
    registerEmojiAnims(this, [...AQUARIUM_TYPES, ...TREASURE_TYPES]);
    const W = this.scale.width;
    const H = this.scale.height;

    this.reduceMotion = (typeof window !== "undefined" && window.matchMedia)
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

    this.bg = new AquariumBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.fx = new Celebrations(this);

    this.fish = this.add.group();
    this.spawnTimer = 0;
    this._t = 0;
    this.aqState = initialAquariumState();
    this.lastTreasure = null;

    // Dedicated looping music (quieter so SFX stay crisp), streamed on first
    // entry so it isn't part of the initial download. Robust autoplay (immediate
    // + delayed retry + unlock/first-tap); `left` guards every deferred path so a
    // late track-load or retry can't resurrect music after we've left the scene.
    let music: Phaser.Sound.BaseSound | undefined;
    let left = false;
    const startMusic = () => { if (!left && music && !music.isPlaying) music.play(); };
    ensureAudioLoaded(this, "aquarium", () => {
      if (left) return;
      music = this.sound.add("aquarium", { loop: true, volume: 0.38 });
      startMusic();
      this.time.delayedCall(200, startMusic);
      if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
      this.input.once("pointerdown", startMusic);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      left = true;
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.sound.off(Phaser.Sound.Events.UNLOCKED, startMusic);
      music?.stop();
      this.sound.stopAll();
      // NOTE: do NOT iterate `this.fish` here. The Group registers its own
      // SHUTDOWN listener when created (earlier in create()), so it destroys
      // itself BEFORE this handler runs — calling this.fish.getChildren() would
      // then throw ("Array.from(undefined)") and abort the whole scene
      // transition, leaving no active scene (a hard freeze). The 💤 labels are
      // scene display-list objects and are auto-destroyed by the shutdown, so no
      // manual cleanup is needed.
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
      this.spawnAmbient(x, y, dir);
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
    f.setData("treasure", false);
    return f;
  }

  // Ambient/initial spawn: ~1 in 5 is a floating treasure (object) instead of a
  // creature. Split/school call spawnFishAt directly, so they only ever produce
  // creatures (treasure stays false there).
  private spawnAmbient(x: number, y: number, dir: number): Fish {
    const isTreasure = Math.random() < TREASURE_CHANCE;
    const pool = isTreasure ? TREASURE_TYPES : AQUARIUM_TYPES;
    const f = this.spawnFishAt(x, y, dir, pool[Math.floor(Math.random() * pool.length)]);
    f.setData("treasure", isTreasure);
    return f;
  }

  // Short-lived rising "bubbles" as Arc GameObjects (no texture -> no Phaser-4
  // generateTexture gotcha). Halved under reduced-motion.
  private emitBubbles(x: number, y: number, count: number, spread: number) {
    const n = this.reduceMotion ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i++) {
      const bx = x + (Math.random() * 2 - 1) * spread;
      const r = 7 + Math.random() * 13;
      const b = this.add.circle(bx, y, r, 0xffffff, 0.6).setDepth(55);
      b.setStrokeStyle(3, 0xffffff, 0.9);
      this.tweens.add({
        targets: b, y: y - (90 + Math.random() * 100), alpha: 0,
        duration: 700 + Math.random() * 500, ease: "Sine.out", onComplete: () => b.destroy(),
      });
    }
  }

  // Guaranteed, unmistakable feedback on EVERY tap: a punchy sparkle ring at the
  // touch point, so even the gentlest reaction obviously "does something."
  private tapBurst(x: number, y: number) {
    const n = this.reduceMotion ? 6 : 12;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 75 + Math.random() * 55;
      const s = this.add.image(x, y, ATLAS_KEY, frameFor("sparkle")).setScale(1).setDepth(58);
      this.tweens.add({
        targets: s, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist,
        scale: 0, alpha: 0, duration: 400, ease: "Cubic.out", onComplete: () => s.destroy(),
      });
    }
  }

  // A quick scale "pop" used for the shockwave's per-fish wave (bigger + sound-free
  // so a tankful reacting at once doesn't turn into an audio pile-up).
  private quickPop(fish: Fish) {
    this.tweens.add({
      targets: fish, scale: ITEM_SCALE * 1.5, yoyo: true, duration: 160,
      ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE),
    });
  }

  private tryTap(px: number, py: number) {
    const actives = (this.fish.getChildren() as Fish[]).filter((f) => f.active);
    if (!actives.length) return;
    const idx = pickNearestWithinRadius(px, py, actives.map((f) => ({ x: f.x, y: f.y })), TAP_RADIUS);
    if (idx < 0) return;
    const fish = actives[idx];
    const now = this._t;

    // Treasures (floating objects) get their own reactions, never nap, and never
    // a creature pick — so a drifting ring/sailboat/bottle never acts "alive."
    if (fish.getData("treasure")) { this.applyTreasureReaction(fish); return; }

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
    // Universal feedback: every tap throws a sparkle ring, regardless of which
    // reaction rolled — so the child always sees an unmistakable response.
    this.tapBurst(fish.x, fish.y);
    switch (reaction.id) {
      case "spin": this.rSpin(fish); break;
      case "wiggle": this.rWiggle(fish); break;
      case "bubble": this.rBubble(fish); break;
      case "squash": this.rSquash(fish); break;
      case "colorflash": this.rColorFlash(fish); break;
      case "heart": this.rHeart(fish); break;
      case "split": this.rSplit(fish, reaction); break;
      case "bubblestream": this.rBubbleStream(fish); break;
      case "zoom": this.rZoom(fish); break;
      case "morph": this.rMorph(fish); break;
      case "backflip": this.rBackflip(fish); break;
      case "giant": this.rGiant(fish); break;
      case "school": this.rSchool(fish, reaction); break;
      case "shockwave": this.rShockwave(fish); break;
      case "treasure": this.rTreasure(fish); break;
      default: this.rWiggle(fish); break;
    }
  }

  // --- Treasure (floating object) reactions: curated, object-only ---
  private applyTreasureReaction(f: Fish) {
    this.tweens.killTweensOf(f);
    f.setAngle(0).setScale(ITEM_SCALE).clearTint();
    this.tapBurst(f.x, f.y);
    const r = pickTreasureReaction(Math.random, this.lastTreasure);
    this.lastTreasure = r;
    switch (r) {
      case "gleam": this.tGleam(f); break;
      case "spin": this.rSpin(f); break;
      case "bubble": this.rBubble(f); break;
      case "grow": this.tGrow(f); break;
      case "reveal": this.tReveal(f); break;
      default: this.tGleam(f); break;
    }
  }
  private tGleam(f: Fish) {
    const cols = GOLD_COLORS;
    this.tweens.addCounter({
      from: 0, to: cols.length * 2, duration: 650,
      onUpdate: (tw) => { if (f.active) f.setTint(cols[Math.floor(tw.getValue() ?? 0) % cols.length]); },
      onComplete: () => { if (f.active) f.clearTint(); },
    });
    this.tweens.add({ targets: f, scale: ITEM_SCALE * 1.4, yoyo: true, duration: 320, ease: "Sine.inOut", onComplete: () => f.setScale(ITEM_SCALE) });
    this.tapBurst(f.x, f.y);
    this.sound.play("chime", { volume: 0.5 });
  }
  private tGrow(f: Fish) {
    this.tweens.add({ targets: f, scale: ITEM_SCALE * 2.6, yoyo: true, hold: 250, duration: 300, ease: "Back.inOut", onComplete: () => f.setScale(ITEM_SCALE) });
    this.sound.play("blub", { volume: 0.5, detune: -200 });
  }
  private tReveal(f: Fish) {
    const which = Math.random() < 0.5 ? "heart" : "gem";
    const o = spawnEmoji(this, f.x, f.y, which).setScale(0.15).setDepth(60);
    this.tweens.add({ targets: o, scale: 0.6, duration: 220, ease: "Back.out" });
    this.tweens.add({ targets: o, y: o.y - (130 + Math.random() * 60), alpha: 0, delay: 90, duration: 900, ease: "Sine.out", onComplete: () => o.destroy() });
    this.sound.play("chime", { volume: 0.45 });
  }

  // --- Common reaction handlers (amplified: big motion + sound on every one) ---
  private rSpin(fish: Fish) {
    this.tweens.add({ targets: fish, angle: fish.angle + 360, duration: 450, ease: "Cubic.out", onComplete: () => fish.setAngle(0) });
    this.tweens.add({ targets: fish, scale: ITEM_SCALE * 1.5, yoyo: true, duration: 225, ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE) });
    this.sound.play("blub", { volume: 0.5, detune: Phaser.Math.Between(-100, 100) });
  }
  private rWiggle(fish: Fish) {
    const a = fish.angle;
    this.tweens.add({ targets: fish, angle: a + 32, yoyo: true, repeat: 5, duration: 60, onComplete: () => fish.setAngle(0) });
    this.tweens.add({ targets: fish, scale: ITEM_SCALE * 1.3, yoyo: true, duration: 190, ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE) });
    this.sound.play("blub", { volume: 0.4, detune: Phaser.Math.Between(-80, 80) });
  }
  private rBubble(fish: Fish) {
    this.emitBubbles(fish.x, fish.y - 10, 16, 40);
    this.sound.play("blub", { volume: 0.55, detune: Phaser.Math.Between(-150, 150) });
  }
  private rSquash(fish: Fish) {
    this.tweens.add({
      targets: fish, scaleX: ITEM_SCALE * 1.8, scaleY: ITEM_SCALE * 0.45, yoyo: true, repeat: 1,
      duration: 130, ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE),
    });
    this.sound.play("sproing", { volume: 0.45 });
  }
  private rColorFlash(fish: Fish) {
    const cols = RAINBOW_COLORS;
    this.tweens.addCounter({
      from: 0, to: cols.length * 2, duration: 720,
      onUpdate: (tw) => { if (fish.active) fish.setTint(cols[Math.floor(tw.getValue() ?? 0) % cols.length]); },
      onComplete: () => { if (fish.active) fish.clearTint(); },
    });
    this.tweens.add({ targets: fish, scale: ITEM_SCALE * 1.45, yoyo: true, duration: 360, ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE) });
    this.sound.play("blub", { volume: 0.45, detune: 120 });
  }
  private rHeart(fish: Fish) {
    const n = this.reduceMotion ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const ox = (Math.random() * 2 - 1) * 40;
      const h = spawnEmoji(this, fish.x + ox, fish.y, "heart").setScale(0.15).setDepth(60);
      this.tweens.add({ targets: h, scale: 0.75, duration: 220, ease: "Back.out" });
      this.tweens.add({ targets: h, y: h.y - (130 + Math.random() * 70), alpha: 0, delay: 90, duration: 900, ease: "Sine.out", onComplete: () => h.destroy() });
    }
    this.sound.play("chime", { volume: 0.4 });
  }

  // --- Uncommon reaction handlers ---
  // Split: the parent squashes and a same-species child pops out swimming the
  // other way. Cap-safe via netAdds (and pickReaction already filters split at cap).
  private rSplit(fish: Fish, reaction: Reaction) {
    // Big parent "punch" pop, then the child rockets out further.
    this.tweens.add({ targets: fish, scale: ITEM_SCALE * 1.5, yoyo: true, duration: 150, ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE) });
    const remaining = HARD_CAP - this.fish.countActive(true);
    if (netAdds(reaction, remaining) > 0) {
      const dir = -(fish.getData("dir") as number) || 1;
      const child = this.spawnFishAt(fish.x, fish.y, dir, fish.getData("type") as string);
      child.setScale(ITEM_SCALE * 0.3);
      this.tweens.add({ targets: child, scale: ITEM_SCALE, duration: 360, ease: "Back.out" });
      this.tweens.add({ targets: child, x: child.x + dir * 75, duration: 300, ease: "Cubic.out" });
    }
    this.sound.play("sproing", { volume: 0.6 });
  }
  private rBubbleStream(fish: Fish) {
    this.time.addEvent({
      delay: 70, repeat: 11,
      callback: () => { if (fish.active) this.emitBubbles(fish.x, fish.y - 10, 4, 24); },
    });
    this.sound.play("blub", { volume: 0.5 });
  }
  private rZoom(fish: Fish) {
    const W = this.scale.width;
    const nx = 80 + Math.random() * (W - 160);
    this.emitBubbles(fish.x, fish.y, 12, 16);
    this.tweens.add({ targets: fish, x: nx, duration: 300, ease: "Cubic.inOut" });
    this.tweens.add({ targets: fish, scaleX: ITEM_SCALE * 1.6, scaleY: ITEM_SCALE * 0.8, yoyo: true, duration: 150, ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE) });
    this.sound.play("blub", { volume: 0.5, detune: 250 });
  }
  private rMorph(fish: Fish) {
    const cur = fish.getData("type") as string;
    const others = AQUARIUM_TYPES.filter((t) => t !== cur);
    const nt = others[Math.floor(Math.random() * others.length)];
    this.emitBubbles(fish.x, fish.y, 16, 42);
    this.tapBurst(fish.x, fish.y);
    this.tweens.add({
      targets: fish, scale: ITEM_SCALE * 0.1, angle: fish.angle + 180, duration: 170, ease: "Sine.in",
      onComplete: () => {
        if (!fish.active) return;
        resetEmoji(fish, nt, fish.x, fish.y);
        fish.setData("type", nt);
        fish.setScale(ITEM_SCALE * 0.1).setAngle(0);
        this.tweens.add({ targets: fish, scale: ITEM_SCALE * 1.35, yoyo: true, duration: 280, ease: "Back.out", onComplete: () => fish.setScale(ITEM_SCALE) });
      },
    });
    this.sound.play("sproing", { volume: 0.5 });
  }
  private rBackflip(fish: Fish) {
    const a = fish.angle;
    this.tweens.add({ targets: fish, angle: a - 720, duration: 700, ease: "Cubic.inOut", onComplete: () => fish.setAngle(0) });
    this.tweens.add({ targets: fish, scale: ITEM_SCALE * 1.6, yoyo: true, duration: 350, ease: "Sine.inOut", onComplete: () => fish.setScale(ITEM_SCALE) });
    this.sound.play("sproing", { volume: 0.45, detune: -150 });
  }
  private rGiant(fish: Fish) {
    this.tweens.add({
      targets: fish, scale: ITEM_SCALE * 3.4, yoyo: true, hold: 350, duration: 320,
      ease: "Back.inOut", onComplete: () => fish.setScale(ITEM_SCALE),
    });
    this.sound.play("blub", { volume: 0.6, detune: -350 });
  }

  // --- Rare jackpot handlers ---
  // School: a few mixed friends swim in from an edge. Cap-safe via netAdds
  // (and pickReaction filters school out entirely when already at cap).
  private rSchool(_fish: Fish, reaction: Reaction) {
    const W = this.scale.width, H = this.scale.height;
    const remaining = HARD_CAP - this.fish.countActive(true);
    const adds = netAdds(reaction, remaining);
    for (let i = 0; i < adds; i++) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const x = dir > 0 ? -50 - i * 60 : W + 50 + i * 60;
      const y = 150 + Math.random() * (H - 320);
      const t = AQUARIUM_TYPES[Math.floor(Math.random() * AQUARIUM_TYPES.length)];
      const f = this.spawnFishAt(x, y, dir, t);
      f.setScale(ITEM_SCALE * 0.2);
      this.tweens.add({ targets: f, scale: ITEM_SCALE, duration: 360, ease: "Back.out" });
      this.tapBurst(f.x, f.y);
    }
    this.fx.banner("🐟🐟🐟", "#0077b6", 800);
    this.sound2.fanfare();
  }
  // Rainbow shockwave: a slow low-contrast rainbow overlay (NOT a strobe) +
  // every fish reacts in a staggered wave. Reduced-motion -> a single soft pulse.
  private rShockwave(_fish: Fish) {
    const W = this.scale.width, H = this.scale.height;
    const cols = RAINBOW_COLORS;
    const dur = this.reduceMotion ? 600 : 1100;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, cols[0], 1).setDepth(40).setAlpha(0);
    this.tweens.addCounter({
      from: 0, to: cols.length, duration: dur,
      onUpdate: (tw) => { overlay.fillColor = cols[Math.floor(tw.getValue() ?? 0) % cols.length]; },
    });
    this.tweens.add({
      targets: overlay, alpha: this.reduceMotion ? 0.14 : 0.28, yoyo: true, hold: 250,
      duration: this.reduceMotion ? 300 : 550, ease: "Sine.inOut", onComplete: () => overlay.destroy(),
    });
    // Every fish does a big scale-pop in a staggered wave (sound-free so a full
    // tank doesn't pile up audio). Photosensitivity-safe: single slow sweep.
    const actives = (this.fish.getChildren() as Fish[]).filter((f) => f.active && (f.getData("napUntil") as number) <= this._t);
    actives.forEach((f, i) => {
      this.time.delayedCall(this.reduceMotion ? 0 : i * 60, () => { if (f.active) this.quickPop(f); });
    });
    this.fx.banner("🌈", "#ff5fa2", 800);
    this.sound2.tada();
  }
  // Treasure chest: a shape-based chest rises from the floor, pops open into a
  // gem/sparkle/bubble fountain + fanfare, then sinks. Non-additive (the tapped
  // fish keeps drifting), so always cap-safe.
  private rTreasure(fish: Fish) {
    const H = this.scale.height;
    const floorY = H - 70;
    const cx = fish.x;

    const chest = this.add.container(cx, floorY + 110).setDepth(45).setScale(1.35);
    const body = this.add.graphics();
    body.fillStyle(0x8a5a2b, 1).fillRoundedRect(-50, -28, 100, 52, 8);
    body.fillStyle(0xffd54a, 1).fillRect(-50, -4, 100, 8);
    const lid = this.add.graphics();
    lid.fillStyle(0x6e4420, 1).fillRoundedRect(-50, -46, 100, 22, 8);
    chest.add([body, lid]);

    this.tweens.add({
      targets: chest, y: floorY, duration: 360, ease: "Back.out",
      onComplete: () => {
        this.tweens.add({ targets: lid, y: -72, angle: -16, duration: 240, ease: "Sine.out" });
        this.emitBubbles(cx, floorY - 20, 30, 64);
        this.fx.popAt(cx, floorY - 20);
        this.tapBurst(cx, floorY - 30);
        for (let i = 0; i < 9; i++) {
          const gem = spawnEmoji(this, cx + (Math.random() * 2 - 1) * 55, floorY - 20, "gem").setScale(0.15).setDepth(46);
          this.tweens.add({ targets: gem, scale: 0.55, duration: 220, ease: "Back.out" });
          this.tweens.add({
            targets: gem, y: gem.y - (150 + Math.random() * 130), x: gem.x + (Math.random() * 2 - 1) * 70,
            alpha: 0, delay: 80, duration: 1100 + Math.random() * 400, ease: "Sine.out", onComplete: () => gem.destroy(),
          });
        }
        this.fx.banner("💎", "#ffd54a", 800);
        this.sound2.fanfare();
        this.sound.play("chime", { volume: 0.7 });
        this.time.delayedCall(1800, () => {
          this.tweens.add({ targets: chest, y: floorY + 110, alpha: 0, duration: 400, onComplete: () => chest.destroy() });
        });
      },
    });
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
        this.spawnAmbient(x, y, dir);
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
