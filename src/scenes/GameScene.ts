import Phaser from "phaser";
import { Background } from "./ui/Background";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { AutoFire, resolveTarget, type AimInput, type Bounds } from "../core/input";
import { Sound } from "../audio/sound";
import { getLevel } from "../core/levels";
import { TEMPLATES, assignTypes, layoutFormation } from "../core/formations";
import { findStarEnemyHits, circleOverlap, type Circle } from "../core/collision";
import { nearestEnemy, steerVelocity } from "../core/magnetism";
import { createRng } from "../core/rng";
import { Celebrations } from "./ui/Celebrations";
import type { PlacedEnemy } from "../core/types";
import { BossController } from "../core/boss";

const STAR_SPEED = 900; // px/s upward
const KEY_SPEED = 2100; // px/s for arrow-key movement (3x — snappier left/right for Zoe)
const FIRE_INTERVAL = 0.18;
const COLLECTIBLE_SPEED = 240; // px/s downward
const COLLECTIBLE_SPAWN_INTERVAL = 2.5; // seconds (base)

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
  protected bg!: Background;
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

  protected boss?: Phaser.GameObjects.Image;
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

  // ── Item 3: Collectibles ────────────────────────────────────────────────────
  protected collectibles!: Phaser.GameObjects.Group;
  private collectibleTimer = 0;
  private nextCollectibleIn = 0;

  constructor(key = "Game") {
    super(key);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.bg = new Background(this, W, H);
    this.sound2 = new Sound(this);
    this.sound2.playMusic();

    // Stop music when scene shuts down to avoid layering tracks when transitioning.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sound.stopAll();
    });

    // Unicorn = tinted body (no drawn wings — they read as stray triangles).
    const body = this.add.image(0, 0, ATLAS_KEY, frameFor("unicorn")).setScale(1.6).setTint(0xff8fcf);

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

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown || this.sys.game.device.input.touch === false) {
        this.pointerActive = true;
        this.target = { x: p.worldX, y: p.worldY };
      }
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pointerActive = true;
      this.target = { x: p.worldX, y: p.worldY };
    });

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

    // ── Item 3: Collectibles pool ────────────────────────────────────────────
    this.collectibles = this.add.group();
    this.collectibleTimer = 0;
    this.nextCollectibleIn = COLLECTIBLE_SPAWN_INTERVAL + (Math.random() - 0.5) * 0.8;

    // Initialise previous position for movement-gate
    this._prevUnicornX = this.target.x;
    this._prevUnicornY = this.target.y;

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
    const assigned = assignTypes(tpl, spec.typing, spec.types, rng);
    const placed: PlacedEnemy[] = layoutFormation(tpl, assigned, { width: this.scale.width, height: this.scale.height });
    for (const pe of placed) {
      let img = this.enemies.getFirstDead(false) as Phaser.GameObjects.Image | null;
      if (!img) {
        img = this.add.image(pe.pos.x, pe.pos.y, ATLAS_KEY, frameFor(pe.type)).setScale(1.1);
        this.enemies.add(img);
        // ── Item 5: Per-enemy random phase for sine pulse ─────────────────
        img.setData("phase", Math.random() * Math.PI * 2);
      } else {
        img.setPosition(pe.pos.x, pe.pos.y)
           .setTexture(ATLAS_KEY, frameFor(pe.type))
           .setActive(true).setVisible(true).setScale(1.1);
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
    (this.enemies.getChildren() as Phaser.GameObjects.Image[]).forEach((e) => {
      if (!e.active) return;
      const drift = e.getData("drift");
      e.x = e.getData("baseX") + Math.sin(this.t * drift.swaySpeed) * drift.swayAmplitude;

      // ── Item 5: Sine-based breathe (scale + rotation) ───────────────────
      const phase = e.getData("phase") as number;
      const breathe = Math.sin(this.t * 1.8 + phase);
      e.setScale(1.1 + breathe * 0.055);      // ±5% around base 1.1
      e.setAngle(breathe * 5);                 // ±5°
    });

    const activeStars = (this.stars.getChildren() as Phaser.GameObjects.Star[]).filter((s) => s.active);
    const activeEnemies = (this.enemies.getChildren() as Phaser.GameObjects.Image[]).filter((e) => e.active);

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

  // ── Item 3: Spawn one collectible ───────────────────────────────────────────
  private spawnCollectible() {
    const type = Math.random() < 0.5 ? "gem" : "heart";
    const x = 80 + Math.random() * (this.scale.width - 160);
    let c = this.collectibles.getFirstDead(false) as Phaser.GameObjects.Image | null;
    if (!c) {
      c = this.add.image(x, -40, ATLAS_KEY, frameFor(type)).setScale(1.0);
      this.collectibles.add(c);
    } else {
      c.setPosition(x, -40)
       .setTexture(ATLAS_KEY, frameFor(type))
       .setActive(true).setVisible(true).setScale(1.0).setAngle(0);
    }
  }

  // ── Item 3: Update falling collectibles ─────────────────────────────────────
  private updateCollectibles(dt: number) {
    // Spawn timer with jitter
    this.collectibleTimer += dt;
    if (this.collectibleTimer >= this.nextCollectibleIn) {
      this.collectibleTimer = 0;
      this.nextCollectibleIn = COLLECTIBLE_SPAWN_INTERVAL + (Math.random() - 0.5) * 0.8;
      this.spawnCollectible();
    }

    const ux = this.unicorn.x, uy = this.unicorn.y;
    (this.collectibles.getChildren() as Phaser.GameObjects.Image[]).forEach((c) => {
      if (!c.active) return;

      // Fall and spin
      c.y += COLLECTIBLE_SPEED * dt;
      c.rotation += dt * 2.0;

      // Collect: unicorn overlap check (radius 70)
      if (circleOverlap({ x: c.x, y: c.y, r: 70 }, { x: ux, y: uy, r: 0 })) {
        this.addScore(25);
        this.fx.popAt(c.x, c.y);
        this.sound2.collect();
        this.collectibles.killAndHide(c);
        return;
      }

      // Miss: fell off bottom
      if (c.y > this.scale.height + 50) {
        this.collectibles.killAndHide(c);
      }
    });
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
      this.fx.finale("Zoe"); this.sound2.tada();
      this.time.delayedCall(5500, () => this.scene.start("Rainbow"));
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
    this.boss = this.add.image(this.scale.width / 2, 320, ATLAS_KEY, frameFor(spec.type)).setScale(4).setTint(0xfff0a0);
    this.bossBar = this.add.graphics();
    this.tweens.add({ targets: this.boss, x: this.scale.width / 2 + 80, yoyo: true, repeat: -1, duration: 1600, ease: "Sine.inOut" });
  }

  protected updateBoss(dt: number) {
    if (!this.bossCtl || !this.boss) return;
    this.bossCtl.update(dt);

    // Telegraph phase transition with a color flash.
    if (this.bossCtl.state === "phaseTransition") this.boss.setTint(0xff7777);
    else if (this.bossCtl.state === "active") this.boss.setTint(0xfff0a0);

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
    // ── Item 3: Drive collectibles from the shared update loop ──────────────
    this.updateCollectibles(dt);
  }
}
