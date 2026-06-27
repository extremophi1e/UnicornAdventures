import Phaser from "phaser";
import { PlayroomBackground } from "./ui/PlayroomBackground";
import { Sound } from "../audio/sound";
import { Celebrations } from "./ui/Celebrations";
import { EMOJI } from "../render/emoji";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM } from "../render/catchUnicorn";
import { computeGrid, pageSlice, type GridLayout } from "../core/soundboardLayout";

// Canonical order: 52 emoji creatures + the unicorn (rendered from the catchUnicorn
// sheet). Each name is also the audio-sprite marker. `donut` is the ladybug glyph.
const SOUNDBOARD_ORDER: readonly string[] = [
  "cat", "dog", "rabbit", "chipmunk", "rat",
  "cow", "pig", "horse", "goat", "ox", "chick", "rooster",
  "fox", "bear", "panda", "lion", "tiger", "sloth", "raccoon", "hedgehog", "kangaroo",
  "monkey", "gorilla", "orangutan",
  "octopus", "turtle", "whale", "crab", "penguin", "otter", "seal", "lobster", "jellyfish",
  "owl", "peacock", "eagle", "flamingo", "dove",
  "frog", "snake", "lizard",
  "butterfly", "snail", "ant", "donut", "microbe",
  "trex", "sauropod",
  "robot", "alien", "ghost", "poop", "unicorn",
];

const SWIPE_MIN = 60;   // px horizontal travel to count as a page swipe
const TAP_MAX = 18;     // px travel under which a press counts as a tap

export class SoundboardScene extends Phaser.Scene {
  private bg!: PlayroomBackground;
  private sound2!: Sound;
  private fx!: Celebrations;
  private grid!: GridLayout;
  private page = 0;
  private pageLayer!: Phaser.GameObjects.Container; // holds the current page's buttons
  private arrows: Phaser.GameObjects.Text[] = [];
  private dots: Phaser.GameObjects.Arc[] = [];

  constructor() { super("Soundboard"); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.bg = new PlayroomBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.fx = new Celebrations(this);
    this.page = 0;

    this.grid = computeGrid(W, H, SOUNDBOARD_ORDER.length);
    this.pageLayer = this.add.container(0, 0);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sound.stopAll());

    // Back to title (top-right), like the other modes.
    this.add.text(W - 24, 24, "⬅", { fontSize: "44px", color: "#5a3b8c" })
      .setOrigin(1, 0).setDepth(1000).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("Title"));

    // Horizontal swipe to flip pages (tap vs swipe disambiguated by travel).
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const dx = p.upX - p.downX, dy = p.upY - p.downY;
      if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
        this.gotoPage(this.page + (dx < 0 ? 1 : -1));
      }
    });

    this.buildArrowsAndDots(W, H);
    this.renderPage();
  }

  private gotoPage(next: number) {
    const clamped = Phaser.Math.Clamp(next, 0, this.grid.pages - 1);
    if (clamped === this.page) return;
    this.page = clamped;
    this.renderPage();
  }

  private renderPage() {
    this.pageLayer.removeAll(true); // destroy previous page's buttons
    const names = pageSlice(SOUNDBOARD_ORDER, this.page, this.grid.perPage);
    names.forEach((name, i) => {
      const { cx, cy } = this.grid.cellCenters[i];
      this.makeButton(name, cx, cy, this.grid.cellSize);
    });
    // Arrow visibility + dot highlight.
    this.arrows[0].setVisible(this.page > 0);
    this.arrows[1].setVisible(this.page < this.grid.pages - 1);
    this.dots.forEach((d, i) => d.setFillStyle(i === this.page ? 0x5a3b8c : 0xcdbcdc));
  }

  private makeButton(name: string, cx: number, cy: number, cell: number) {
    const card = this.add.graphics();
    card.fillStyle(0xffffff, 0.85).fillRoundedRect(cx - cell / 2, cy - cell / 2, cell, cell, 26);
    this.pageLayer.add(card);

    const isUni = name === "unicorn";
    const texKey = isUni ? CATCH_UNICORN_KEY : EMOJI[name].key;
    const frameH = isUni ? 256 : EMOJI[name].frameHeight; // 256 / 144
    const spr = this.add.sprite(cx, cy, texKey).setFrame(0); // static idle
    spr.setScale((cell * 0.62) / frameH);
    this.pageLayer.add(spr);

    const zone = this.add.zone(cx, cy, cell + 20, cell + 20).setInteractive({ useHandCursor: true });
    this.pageLayer.add(zone);
    zone.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY) > TAP_MAX) return; // was a swipe
      this.tap(name, spr, isUni, cx, cy);
    });
  }

  private tap(name: string, spr: Phaser.GameObjects.Sprite, isUni: boolean, cx: number, cy: number) {
    this.sound2.voice(name);
    this.fx.popAt(cx, cy);
    const baseScale = spr.scaleX;
    this.tweens.killTweensOf(spr);
    this.tweens.add({
      targets: spr, scaleX: baseScale * 1.18, scaleY: baseScale * 0.86,
      duration: 90, yoyo: true, ease: "Sine.inOut",
      onComplete: () => spr.setScale(baseScale),
    });
    // Briefly bring the creature to life, then settle back to the static frame.
    spr.play(isUni ? CATCH_UNICORN_ANIM : EMOJI[name].anim);
    this.time.delayedCall(800, () => { if (spr.active) { spr.anims.stop(); spr.setFrame(0); } });
  }

  private buildArrowsAndDots(W: number, H: number) {
    const y = H - 80;
    const left = this.add.text(60, y, "◀", { fontSize: "64px", color: "#5a3b8c" })
      .setOrigin(0.5).setDepth(900).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.gotoPage(this.page - 1));
    const right = this.add.text(W - 60, y, "▶", { fontSize: "64px", color: "#5a3b8c" })
      .setOrigin(0.5).setDepth(900).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.gotoPage(this.page + 1));
    this.arrows = [left, right];
    const gap = 30, x0 = W / 2 - ((this.grid.pages - 1) * gap) / 2;
    for (let i = 0; i < this.grid.pages; i++) {
      this.dots.push(this.add.circle(x0 + i * gap, y, 8, 0xcdbcdc).setDepth(900));
    }
  }

  update(_t: number, dms: number) {
    this.bg.update(dms / 1000, this.scale.width);
  }
}
