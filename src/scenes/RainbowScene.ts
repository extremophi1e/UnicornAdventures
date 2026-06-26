import { GameScene } from "./GameScene";
import { generateRainbowWave } from "../core/rainbow";
import { createRng } from "../core/rng";
import type { FormationSpec } from "../core/types";

export class RainbowScene extends GameScene {
  private depth = 1;
  private wave: FormationSpec[] = [];

  constructor() {
    super("Rainbow");
  }

  // Override: formations come from the procedural generator, not authored levels.
  protected currentFormations(): FormationSpec[] {
    if (this.wave.length === 0) this.wave = generateRainbowWave(this.depth, createRng(this.depth * 7919));
    return this.wave;
  }

  // Override: never finish; bump depth and generate the next wave.
  protected onLevelCleared(): void {
    this.sound2.fanfare();
    this.fx.banner("🌈");
    this.depth++;
    this.wave = [];
    this.formationIndex = 0;
    this.time.delayedCall(900, () => this.spawnFormation());
  }

  // Override: rainbow mode has no bosses.
  protected maybeStartBossOrFinish(): void {
    this.onLevelCleared();
  }
}
