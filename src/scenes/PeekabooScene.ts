import Phaser from "phaser";
import { PeekabooBackground } from "./ui/PeekabooBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { EMOJI } from "../render/emoji";
import { Sound, PEEKABOO_MUSIC_KEYS } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { initialCatchState, recordCatch, recordMiss, type CatchState } from "../core/catch";
import { computeSpots, windowForNotch, concurrentForNotch, shouldSurprise, chooseSpot, type Spot } from "../core/peekaboo";
import { loadAtlas, loadEmoji, loadAudio, registerEmojiAnims, showLoadingBar, preloadFirstTrack } from "../render/assets";

const SPAWN_INTERVAL = 850;     // ms between scheduler ticks
const PEEK_RISE = 96;           // px a ground critter rises when peeking
const HIDE_DROP = 44;           // px below the spot centre when hidden (behind the rim)
const COYOTE_MS = 100;          // accept a tap this long into the duck
const SPOT_COOLDOWN_MS = 500;   // min idle time after a spot frees before it can re-pop
const MILESTONE_EVERY = 15;     // catches per celebration
const CRITTER_SCALE = 1.4 / 2;  // /2: 144px emoji frames
const EMERGE_MS = 250, DUCK_MS = 150;
// Only living creatures peek: exclude objects/plants AND the non-animal "silly" set
// (robot, alien, ghost, poop). Kept: all animals, dinos (trex/sauropod), bugs
// (butterfly/snail/ant/donut=ladybug), and the microbe (a living germ).
const NON_CREATURES = [
  "cloud", "star", "icecream", "balloon", "heart", "flower", "gem", "cupcake", "lollipop",
  "robot", "alien", "ghost", "poop",
];
const CRITTER_KEYS = Object.keys(EMOJI).filter((k) => !NON_CREATURES.includes(k));

export class PeekabooScene extends Phaser.Scene {
  private bg!: PeekabooBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private spots: Spot[] = [];
  private spotBusyUntil: number[] = []; // per-spot: ms time.now until which it's unavailable
  private critters!: Phaser.GameObjects.Group;
  private state: CatchState = initialCatchState();
  private score = 0;
  private active = 0;
  private lastSpot = -1;
  private celebratedUpTo = 0;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() { super("Peekaboo"); }

  preload() {
    loadAtlas(this);
    loadEmoji(this, CRITTER_KEYS);
    loadAudio(this, ["giggle1", "giggle2", "giggle3", "fanfare"]);
    preloadFirstTrack(this, PEEKABOO_MUSIC_KEYS);
    showLoadingBar(this);
  }

  create() {
    registerEmojiAnims(this, CRITTER_KEYS);
    const W = this.scale.width, H = this.scale.height;
    this.bg = new PeekabooBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.sound2.playMusic(PEEKABOO_MUSIC_KEYS);
    this.fx = new Celebrations(this);

    this.state = initialCatchState();
    this.score = 0;
    this.active = 0;
    this.lastSpot = -1;
    this.celebratedUpTo = 0;

    this.spots = computeSpots(W, H);
    this.spotBusyUntil = this.spots.map(() => 0);
    this.spots.forEach((s) => this.drawSpot(s));

    this.critters = this.add.group();

    this.scoreText = this.add.text(24, 24, "⭐ 0", {
      fontSize: "44px", color: "#ffffff", fontStyle: "bold", stroke: "#2f7d2a", strokeThickness: 6,
    }).setDepth(1000);

    this.add.text(W - 24, 24, "⬅", { fontSize: "44px" }).setOrigin(1, 0).setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("Title"));

    this.input.addPointer(3); // up to 4 simultaneous touches (two kids)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sound.stopAll());

    this.time.delayedCall(SPAWN_INTERVAL, () => this.spawnTick());
  }

  // Static spot art. Ground spots get a foreground occluder (depth 20) above the
  // critter (depth 12); cloud spots sit behind the critter (depth 8).
  private drawSpot(s: Spot) {
    const g = this.add.graphics();
    if (s.type === "cloud") {
      g.setDepth(8);
      g.fillStyle(0xffffff, 0.95).fillEllipse(s.x, s.y, 190, 96);
      g.fillStyle(0xffffff, 0.95).fillEllipse(s.x - 60, s.y + 12, 110, 70);
      g.fillStyle(0xffffff, 0.95).fillEllipse(s.x + 60, s.y + 14, 120, 72);
    } else if (s.type === "burrow") {
      g.setDepth(20);
      g.fillStyle(0x6b4a2b, 1).fillEllipse(s.x, s.y + 10, 150, 60);   // hole
      g.fillStyle(0x3a2a18, 1).fillEllipse(s.x, s.y + 6, 120, 44);    // hole shadow
      g.fillStyle(0x2f7d2a, 1).fillEllipse(s.x, s.y + 34, 168, 40);   // grass rim (occluder front)
    } else { // flower clump occluder
      g.setDepth(20);
      const petals = [0xff6fa5, 0xffd23f, 0x9b6bff, 0x5bc0ff, 0xff8fcf];
      g.fillStyle(0x2f7d2a, 1).fillEllipse(s.x, s.y + 40, 170, 46);   // leaves
      for (let i = 0; i < 5; i++) {
        const fx = s.x - 64 + i * 32, c = petals[i % petals.length];
        g.fillStyle(c, 1).fillCircle(fx, s.y + 30, 16);
        g.fillStyle(0xffffff, 0.85).fillCircle(fx, s.y + 30, 6);
      }
    }
  }

  private spawnTick() {
    if (this.active < concurrentForNotch(this.state.notch)) {
      if (shouldSurprise(Math.random)) {
        const W = this.scale.width, H = this.scale.height;
        const x = 90 + Math.random() * (W - 180);
        const y = H * 0.42 + Math.random() * (H * 0.4);
        this.popCritter(null, x, y);
      } else {
        const now = this.time.now;
        const idle = this.spots.filter((s) => this.spotBusyUntil[s.id] <= now).map((s) => s.id);
        const id = chooseSpot(idle, this.lastSpot, Math.random);
        if (id >= 0) {
          this.lastSpot = id;
          this.spotBusyUntil[id] = Number.MAX_SAFE_INTEGER; // busy while visible
          const s = this.spots[id];
          this.popCritter(s, s.x, s.y);
        }
      }
    }
    this.time.delayedCall(SPAWN_INTERVAL, () => this.spawnTick());
  }

  // Pop a critter at a spot (spot != null) or a free-floating surprise (spot == null).
  private popCritter(spot: Spot | null, x: number, y: number) {
    this.active += 1;
    const key = CRITTER_KEYS[Math.floor(Math.random() * CRITTER_KEYS.length)];
    const ground = spot ? spot.type !== "cloud" : false;
    const downY = ground ? y + HIDE_DROP : y;
    const upY = ground ? y - PEEK_RISE : y;

    let c = this.critters.getFirstDead(false) as Phaser.GameObjects.Sprite | null;
    if (!c) { c = spawnEmoji(this, x, downY, key); this.critters.add(c); }
    else { this.tweens.killTweensOf(c); resetEmoji(c, key, x, downY); }
    c.setDepth(12).setAngle(0).setAlpha(1).clearTint();
    c.setScale(ground ? CRITTER_SCALE : 0.01);
    c.setData("caught", false);
    c.setData("spotId", spot ? spot.id : -1);
    c.setInteractive({ useHandCursor: true });
    c.off("pointerdown");
    c.on("pointerdown", () => this.tryCatch(c!));

    if (spot === null) this.fx.popAt(x, y); // little surprise puff

    const win = windowForNotch(this.state.notch);
    // Catchable from emerge start until just into the duck (coyote window). A
    // timestamp (not a flag+timer) avoids stale timers acting on a pooled, reused sprite.
    c.setData("catchUntil", this.time.now + EMERGE_MS + win + COYOTE_MS);
    const emerge = ground
      ? { targets: c, y: upY, duration: EMERGE_MS, ease: "Back.Out" }
      : { targets: c, scale: CRITTER_SCALE, duration: EMERGE_MS, ease: "Back.Out" };
    const duck = ground
      ? { targets: c, y: downY, duration: DUCK_MS, delay: win, ease: "Power2.In" }
      : { targets: c, scale: 0.01, duration: DUCK_MS, delay: win, ease: "Power2.In" };
    this.tweens.chain({ tweens: [emerge, duck], onComplete: () => this.onDuckComplete(c!) });
  }

  private tryCatch(c: Phaser.GameObjects.Sprite) {
    if (c.getData("caught") || this.time.now > (c.getData("catchUntil") as number)) return;
    c.setData("caught", true);
    c.disableInteractive();
    this.tweens.killTweensOf(c);
    this.score += 1;
    this.scoreText.setText(`⭐ ${this.score}`);
    this.state = recordCatch(this.state);
    this.sound2.giggle();
    this.fx.popAt(c.x, c.y);
    this.freeSpot(c);
    const base = c.scaleX || CRITTER_SCALE;
    this.tweens.add({
      targets: c, scaleX: base * 1.3, scaleY: base * 0.7, duration: 90, yoyo: true, ease: "Sine.inOut",
      onComplete: () => this.tweens.add({
        targets: c, scale: 0.01, alpha: 0, duration: 160, ease: "Back.In", onComplete: () => this.retire(c),
      }),
    });
    this.milestoneCheck();
  }

  private onDuckComplete(c: Phaser.GameObjects.Sprite) {
    if (c.getData("caught")) return; // caught path already handled it
    this.state = recordMiss(this.state);
    this.freeSpot(c);
    this.retire(c);
  }

  private freeSpot(c: Phaser.GameObjects.Sprite) {
    const id = c.getData("spotId") as number;
    if (id >= 0) this.spotBusyUntil[id] = this.time.now + SPOT_COOLDOWN_MS;
  }

  private retire(c: Phaser.GameObjects.Sprite) {
    c.disableInteractive();
    this.critters.killAndHide(c);
    this.active = Math.max(0, this.active - 1);
  }

  private milestoneCheck() {
    const m = Math.floor(this.score / MILESTONE_EVERY);
    if (m > this.celebratedUpTo) {
      this.celebratedUpTo = m;
      this.fx.bigPartyNoShake();
      this.fx.banner("🌈");
      this.sound2.fanfare();
    }
  }

  update(_t: number, dms: number) {
    this.bg.update(dms / 1000);
  }
}
