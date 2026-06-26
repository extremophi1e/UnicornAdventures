import Phaser from "phaser";
import { Background } from "./ui/Background";
import { ATLAS_KEY, frameFor } from "../render/sprites";
import { AutoFire, resolveTarget, type AimInput, type Bounds } from "../core/input";
import { Sound } from "../audio/sound";
import { getLevel } from "../core/levels";
import { TEMPLATES, assignTypes, layoutFormation } from "../core/formations";
import { findStarEnemyHits, type Circle } from "../core/collision";
import { nearestEnemy, steerVelocity } from "../core/magnetism";
import { createRng } from "../core/rng";
import { Celebrations } from "./ui/Celebrations";
import type { PlacedEnemy } from "../core/types";
import { BossController } from "../core/boss";

const STAR_SPEED = 900; // px/s upward
const KEY_SPEED = 700;
const FIRE_INTERVAL = 0.18;

export class GameScene extends Phaser.Scene {
  protected bg!: Background;
  protected sound2!: Sound;
  protected unicorn!: Phaser.GameObjects.Container;
  protected target = { x: 360, y: 1120 };
  protected stars!: Phaser.GameObjects.Group;
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

    // Unicorn = tinted body + simple drawn wings + sparkle trail anchor.
    const body = this.add.image(0, 0, ATLAS_KEY, frameFor("unicorn")).setScale(1.6).setTint(0xff8fcf);
    const wingL = this.add.triangle(-44, 6, 0, 0, 40, -18, 36, 26, 0xffffff, 0.9);
    const wingR = this.add.triangle(44, 6, 0, 0, -40, -18, -36, 26, 0xffffff, 0.9);
    this.unicorn = this.add.container(this.target.x, this.target.y, [wingL, body, wingR]);

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
    this.spawnFormation();
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
    let s = this.stars.getFirstDead(false) as Phaser.GameObjects.Image | null;
    if (!s) {
      s = this.add.image(x, y, ATLAS_KEY, frameFor("star")).setScale(0.8);
      this.stars.add(s);
    } else {
      s.setPosition(x, y).setActive(true).setVisible(true);
    }
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
      } else {
        img.setPosition(pe.pos.x, pe.pos.y)
           .setTexture(ATLAS_KEY, frameFor(pe.type))
           .setActive(true).setVisible(true).setScale(1.1);
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
    });

    const activeStars = (this.stars.getChildren() as Phaser.GameObjects.Image[]).filter((s) => s.active);
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
    }

    // harmless bounce: enemy touching unicorn just sparkles and drifts back, no penalty
    const ux = this.unicorn.x, uy = this.unicorn.y;
    activeEnemies.forEach((e) => {
      if (!e.active) return;
      const dx = e.x - ux, dy = e.y - uy;
      if (dx * dx + dy * dy < 90 * 90) {
        this.fx.popAt((e.x + ux) / 2, (e.y + uy) / 2);
        e.setData("baseX", e.getData("baseX") + (dx >= 0 ? 30 : -30));
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
      this.fx.finale("Zoe"); this.sound2.tada();
      this.time.delayedCall(1500, () => this.scene.start("Rainbow"));
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
    const activeStars = (this.stars.getChildren() as Phaser.GameObjects.Image[]).filter((s) => s.active);
    if (this.bossCtl.isVulnerable()) {
      for (const s of activeStars) {
        const dx = s.x - this.boss.x, dy = s.y - this.boss.y;
        if (dx * dx + dy * dy < 150 * 150) {
          this.bossCtl.hit(1);
          this.fx.popAt(s.x, s.y);
          this.sound2.pop();
          this.stars.killAndHide(s);
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

    for (const shot of Array(this.autofire.update(dt)).fill(0)) void shot, this.fireStar();

    (this.stars.getChildren() as Phaser.GameObjects.Image[]).forEach((s) => {
      if (!s.active) return;
      s.y -= STAR_SPEED * dt;
      if (s.y < -40) this.stars.killAndHide(s);
    });

    this.updateEnemies(dt);
    this.updateBoss(dt);
  }
}
