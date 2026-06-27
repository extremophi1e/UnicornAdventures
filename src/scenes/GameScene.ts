import Phaser from "phaser";
import { SpaceBackground } from "./ui/SpaceBackground";
import { spawnEmoji, resetEmoji } from "../render/emojiSprite";
import { CATCH_UNICORN_KEY, CATCH_UNICORN_ANIM } from "../render/catchUnicorn";
import { AutoFire, resolveTarget, type AimInput, type Bounds } from "../core/input";
import { Sound } from "../audio/sound";
import { getLevel } from "../core/levels";
import { TEMPLATES, assignTypes, layoutFormation } from "../core/formations";
import { findStarEnemyHits, circleOverlap, type Circle } from "../core/collision";
import { nearestEnemy, steerVelocity } from "../core/magnetism";
import { createRng } from "../core/rng";
import { Celebrations } from "./ui/Celebrations";
import type { PlacedEnemy, CuteType } from "../core/types";
import { BossController } from "../core/boss";

const STAR_SPEED = 900; // px/s upward
const KEY_SPEED = 2100; // px/s for arrow-key movement (3x — snappier left/right for Zoe)
const FIRE_INTERVAL = 0.18;
const FINGER_LIFT = 120; // on touch, aim the unicorn this far above the finger so it isn't hidden

// Rainbow Shoot enemy set: bugs (ant, snail, butterfly, donut=ladybug, microbe) +
// robot + poop + a couple of sky/sea critters (cloud, star, trex, jellyfish). These
// override each level's authored type list at spawn time. Bosses are always the robot.
const SHOOTER_TYPES: CuteType[] = [
  "ant", "snail", "butterfly", "donut", "microbe", "robot", "poop", "cloud", "star", "trex", "jellyfish",
];
const SHOOTER_BOSS_TYPE: CuteType = "robot";

// Rainbow colours the shot stars cycle through (ROYGBIV), bright and kid-friendly.
const RAINBOW_STAR_COLORS = [
  0xff3b30, // red
  0xff9500, // orange
  0xffcc00, // yellow
  0x34c759, // green
  0x00a3ff, // blue
  0x5e5ce6, // indigo
  0xaf52de, // violet
];

export class GameScene extends Phaser.Scene {
  protected bg!: SpaceBackground;
  protected sound2!: Sound;
  protected unicorn!: Phaser.GameObjects.Container;
  protected target = { x: 360, y: 1120 };
  protected stars!: Phaser.GameObjects.Group;
  protected starColor = 0;
  protected autofire = new AutoFire(FIRE_INTERVAL);
  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  protected pointerActive = false;

  protected enemies!: Phaser.GameObjects.Group;
  protected fx!: Celebrations;
  protected levelIndex = 1;
  protected formationIndex = 0;
  protected t = 0;
  protected transitioning = false;

  protected boss?: Phaser.GameObjects.Sprite;
  protected bossCtl?: BossController;
  protected bossBar?: Phaser.GameObjects.Graphics;

  // ── Rainbow trail (fading rainbow circles dropped behind the unicorn) ─────────
  private _prevUnicornX = 0;
  private _prevUnicornY = 0;
  private _trailColor = 0;
  private _trailAccum = 0;

  // ── Item 2: Score ───────────────────────────────────────────────────────────
  protected score!: number;
  protected scoreText!: Phaser.GameObjects.Text;

  constructor(key = "Game") {
    super(key);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.bg = new SpaceBackground(this, W, H);
    this.sound2 = new Sound(this);
    this.sound2.playMusic();

    // Stop music when scene shuts down to avoid layering tracks when transitioning.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sound.stopAll();
    });

    // Unicorn = the unified animated sprite (same one used on the title and in Catch).
    const body = this.add.sprite(0, 0, CATCH_UNICORN_KEY).setScale(0.55).play(CATCH_UNICORN_ANIM);

    this.unicorn = this.add.container(this.target.x, this.target.y, [body]);
    this.unicorn.setDepth(10); // render above the rainbow trail dots (spawned at depth 5)

    // ── Item 5: Alive pulse tween on unicorn container ───────────────────────
    this.tweens.add({
      targets: this.unicorn,
      scaleX: 1.06,
      scaleY: 1.06,
      angle: { from: -4, to: 4 },
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      duration: 900,
    });

    this.stars = this.add.group();
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Plain pointer movement moves the unicorn — no click/drag needed.
    // (On touch devices pointermove only fires while a finger is down, so this
    //  still behaves as drag-to-move there.)
    // Touch lifts the unicorn above the finger so it isn't hidden; mouse aims exactly.
    const setTarget = (p: Phaser.Input.Pointer) => {
      this.pointerActive = true;
      this.target = { x: p.worldX, y: p.worldY - (p.wasTouch ? FINGER_LIFT : 0) };
    };
    this.input.on("pointermove", setTarget);
    this.input.on("pointerdown", setTarget);

    this.enemies = this.add.group();
    this.fx = new Celebrations(this);

    // ── Item 2: Score display ────────────────────────────────────────────────
    this.score = 0;
    this.scoreText = this.add
      .text(24, 24, "⭐ 0", {
        fontSize: "44px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#7a3fa0",
        strokeThickness: 6,
      })
      .setDepth(1000);

    // Back-to-title button (top-right), like the catch game.
    this.add.text(W - 24, 24, "⬅", { fontSize: "44px", color: "#ffffff" })
      .setOrigin(1, 0).setDepth(1000).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("Title"));

    // Initialise previous position for movement-gate
    this._prevUnicornX = this.target.x;
    this._prevUnicornY = this.target.y;

    // Reset run progression on every entry. Phaser reuses the scene instance, so
    // the class-field initializers don't re-run — without this, returning to the
    // title after the finale and re-entering would resume on the last level.
    this.levelIndex = 1;
    this.formationIndex = 0;
    this.t = 0;
    this.transitioning = false;
    this.boss = undefined;
    this.bossCtl = undefined;
    this.bossBar = undefined;
    this.autofire.reset();

    this.spawnFormation();
  }

  // ── Item 2: addScore helper ─────────────────────────────────────────────────
  protected addScore(n: number) {
    this.score += n;
    this.scoreText?.setText(`⭐ ${this.score}`);
  }

  protected bounds(): Bounds {
    return { minX: 50, maxX: this.scale.width - 50, minY: this.scale.height - 420, maxY: this.scale.height - 70 };
  }

  protected aimInput(): AimInput {
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

  protected fireStar() {
    const x = this.unicorn.x;
    const y = this.unicorn.y - 60;
    const color = RAINBOW_STAR_COLORS[this.starColor];
    this.starColor = (this.starColor + 1) % RAINBOW_STAR_COLORS.length;
    let s = this.stars.getFirstDead(false) as Phaser.GameObjects.Star | null;
    if (!s) {
      s = this.add.star(x, y, 5, 10, 24, color);
      this.stars.add(s);
    } else {
      s.setPosition(x, y).setFillStyle(color).setActive(true).setVisible(true);
    }
    s.setData("vx", 0);
  }

  protected currentFormations() {
    return getLevel(this.levelIndex).formations;
  }

  protected spawnFormation() {
    const spec = this.currentFormations()[this.formationIndex];
    const tpl = TEMPLATES[spec.templateId];
    const rng = createRng(this.levelIndex * 100 + this.formationIndex);
    // Override the level's authored types: the shooter only ever fields bugs+robot+poop.
    const assigned = assignTypes(tpl, spec.typing, SHOOTER_TYPES, rng);
    const placed: PlacedEnemy[] = layoutFormation(tpl, assigned, { width: this.scale.width, height: this.scale.height });
    for (const pe of placed) {
      let img = this.enemies.getFirstDead(false) as Phaser.GameObjects.Sprite | null;
      if (!img) {
        img = spawnEmoji(this, pe.pos.x, pe.pos.y, pe.type).setScale(1.1 / 2);
        this.enemies.add(img);
        // ── Item 5: Per-enemy random phase for sine pulse ─────────────────
        img.setData("phase", Math.random() * Math.PI * 2);
      } else {
        resetEmoji(img, pe.type, pe.pos.x, pe.pos.y).setScale(1.1 / 2);
        // Re-assign phase on reuse so each wave feels fresh
        img.setData("phase", Math.random() * Math.PI * 2);
      }
      img.setData("baseX", pe.pos.x);
      img.setData("drift", spec.drift);
    }
    this.transitioning = false;
  }

  protected updateEnemies(dt: number) {
    this.t += dt;
    (this.enemies.getChildren() as Phaser.GameObjects.Sprite[]).forEach((e) => {
      if (!e.active) return;
      const drift = e.getData("drift");
      e.x = e.getData("baseX") + Math.sin(this.t * drift.swaySpeed) * drift.swayAmplitude;

      // ── Item 5: Sine-based breathe (scale + rotation) ───────────────────
      const phase = e.getData("phase") as number;
      const breathe = Math.sin(this.t * 1.8 + phase);
      e.setScale((1.1 + breathe * 0.055) / 2); // ±5% around base (/2 for 144px emoji frames)
      e.setAngle(breathe * 5);                 // ±5°
    });

    const activeStars = (this.stars.getChildren() as Phaser.GameObjects.Star[]).filter((s) => s.active);
    const activeEnemies = (this.enemies.getChildren() as Phaser.GameObjects.Sprite[]).filter((e) => e.active);

    // Bullet magnetism: steer each star toward nearest enemy.
    activeStars.forEach((s) => {
      const idx = nearestEnemy({ x: s.x, y: s.y }, activeEnemies.map((e) => ({ x: e.x, y: e.y })), 160);
      if (idx >= 0) {
        const v = steerVelocity({ x: (s.getData("vx") ?? 0), y: -1 }, { x: s.x, y: s.y }, { x: activeEnemies[idx].x, y: activeEnemies[idx].y }, 6, dt);
        s.x += v.x * dt * 300;
        s.setData("vx", v.x);
      }
    });

    const starCircles: Circle[] = activeStars.map((s) => ({ x: s.x, y: s.y, r: 22 }));
    const enemyCircles: Circle[] = activeEnemies.map((e) => ({ x: e.x, y: e.y, r: 55 })); // generous
    const hits = findStarEnemyHits(starCircles, enemyCircles);
    for (const h of hits) {
      const e = activeEnemies[h.enemyIndex];
      this.fx.popAt(e.x, e.y);
      this.sound2.pop();
      this.enemies.killAndHide(e);
      this.stars.killAndHide(activeStars[h.starIndex]);
      // ── Item 2: Score +10 per enemy popped ──────────────────────────────
      this.addScore(10);
    }

    // harmless bounce: enemy touching unicorn just sparkles and drifts back, no penalty
    const ux = this.unicorn.x, uy = this.unicorn.y;
    activeEnemies.forEach((e) => {
      if (!e.active) return;
      if (circleOverlap({ x: e.x, y: e.y, r: 90 }, { x: ux, y: uy, r: 0 })) {
        this.fx.popAt((e.x + ux) / 2, (e.y + uy) / 2);
        e.setData("baseX", e.getData("baseX") + (e.x >= ux ? 30 : -30));
      }
    });

    if (!this.transitioning && activeEnemies.length - hits.length <= 0 && this.enemies.countActive() === 0) {
      this.transitioning = true;
      this.onFormationCleared();
    }
  }

  protected onFormationCleared() {
    const formations = this.currentFormations();
    if (this.formationIndex < formations.length - 1) {
      this.formationIndex++;
      this.fx.banner("More!", "#ff9f43");
      this.time.delayedCall(700, () => this.spawnFormation());
    } else {
      this.maybeStartBossOrFinish();
    }
  }

  protected onLevelCleared() {
    this.bossCtl = undefined;
    this.bossBar = undefined;
    this.formationIndex = 0;
    if (this.levelIndex >= 12) {
      // Final level: one BIG finale (boss already played bigParty+tada). No medium tier.
      this.fx.finale(); this.sound2.tada();
      this.time.delayedCall(5500, () => this.scene.start("Title"));
      return;
    }
    if (getLevel(this.levelIndex).boss) {
      // Boss level: boss already played bigParty+tada in updateBoss. No medium tier here.
      this.levelIndex++;
      this.formationIndex = 0;
      this.time.delayedCall(1200, () => this.spawnFormation());
      return;
    }
    // Normal level: play MEDIUM tier.
    this.sound2.fanfare();
    this.fx.banner("Yay! 🌈");
    this.levelIndex++;
    this.formationIndex = 0;
    this.time.delayedCall(1200, () => this.spawnFormation());
  }

  protected maybeStartBossOrFinish() {
    const lvl = getLevel(this.levelIndex);
    if (lvl.boss && !this.bossCtl) {
      this.startBoss();
    } else {
      this.onLevelCleared();
    }
  }

  protected startBoss() {
    const spec = getLevel(this.levelIndex).boss!;
    this.bossCtl = new BossController(spec);
    this.boss = spawnEmoji(this, this.scale.width / 2, 320, SHOOTER_BOSS_TYPE).setScale(4 / 2);
    this.bossBar = this.add.graphics();
    this.tweens.add({ targets: this.boss, x: this.scale.width / 2 + 80, yoyo: true, repeat: -1, duration: 1600, ease: "Sine.inOut" });
  }

  protected updateBoss(dt: number) {
    if (!this.bossCtl || !this.boss) return;
    this.bossCtl.update(dt);

    // Telegraph phase transition with a color flash.
    if (this.bossCtl.state === "phaseTransition") this.boss.setTint(0xff7777);
    else this.boss.clearTint();

    // Stars hit the boss only while vulnerable.
    const activeStars = (this.stars.getChildren() as Phaser.GameObjects.Star[]).filter((s) => s.active);
    if (this.bossCtl.isVulnerable()) {
      for (const s of activeStars) {
        if (circleOverlap({ x: s.x, y: s.y, r: 0 }, { x: this.boss.x, y: this.boss.y, r: 150 })) {
          this.bossCtl.hit(1);
          this.fx.popAt(s.x, s.y);
          this.sound2.pop();
          this.stars.killAndHide(s);
          if (this.bossCtl.state === "defeated") { break; }
          // ── Item 2: Score +5 per boss hit ───────────────────────────────
          this.addScore(5);
        }
      }
    }

    // Happiness meter (top of screen).
    const frac = Math.max(0, this.bossCtl.hp / getLevel(this.levelIndex).boss!.maxHp);
    this.bossBar!.clear().fillStyle(0xffffff, 0.4).fillRoundedRect(120, 120, this.scale.width - 240, 28, 14)
      .fillStyle(0xff5fa2, 1).fillRoundedRect(120, 120, (this.scale.width - 240) * frac, 28, 14);

    if (this.bossCtl.state === "defeated") {
      this.boss.destroy(); this.bossBar!.destroy();
      this.boss = undefined; this.bossCtl = undefined; this.bossBar = undefined;
      this.fx.bigParty(); this.sound2.tada();
      this.onLevelCleared();
    }
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.bg.update(dt, this.scale.width);

    if (this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown || this.cursors.down.isDown) {
      this.pointerActive = false; // keyboard takes over
    }
    const cur = { x: this.unicorn.x, y: this.unicorn.y };
    const next = resolveTarget(cur, this.aimInput(), KEY_SPEED, dt, this.bounds());
    // Smooth follow.
    this.unicorn.x = Phaser.Math.Linear(this.unicorn.x, next.x, Math.min(1, 12 * dt));
    this.unicorn.y = Phaser.Math.Linear(this.unicorn.y, next.y, Math.min(1, 12 * dt));

    // ── Rainbow trail: drop fading rainbow circles behind the unicorn while moving ──
    const tdx = this.unicorn.x - this._prevUnicornX;
    const tdy = this.unicorn.y - this._prevUnicornY;
    const moved = Math.sqrt(tdx * tdx + tdy * tdy) > 2;
    this._trailAccum += dt;
    if (moved && this._trailAccum >= 0.025) {
      this._trailAccum = 0;
      const color = RAINBOW_STAR_COLORS[this._trailColor];
      this._trailColor = (this._trailColor + 1) % RAINBOW_STAR_COLORS.length;
      const dot = this.add.circle(this.unicorn.x, this.unicorn.y + 12, 16, color);
      dot.setDepth(5); // behind the unicorn (depth 10), above the background
      this.tweens.add({
        targets: dot,
        alpha: { from: 0.9, to: 0 },
        scale: { from: 1, to: 0.2 },
        duration: 520,
        ease: "Sine.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
    this._prevUnicornX = this.unicorn.x;
    this._prevUnicornY = this.unicorn.y;

    for (const shot of Array(this.autofire.update(dt)).fill(0)) void shot, this.fireStar();

    (this.stars.getChildren() as Phaser.GameObjects.Star[]).forEach((s) => {
      if (!s.active) return;
      s.y -= STAR_SPEED * dt;
      if (s.y < -40) this.stars.killAndHide(s);
    });

    this.updateEnemies(dt);
    this.updateBoss(dt);
  }
}
