import type { BossSpec } from "./types";

export type BossState = "entering" | "active" | "phaseTransition" | "defeated";

const ENTRY_TIME = 1.5;
const TRANSITION_TIME = 1.0;

export class BossController {
  hp: number;
  state: BossState = "entering";
  phase = 1;
  private timer = 0;
  private readonly maxHp: number;
  private readonly phases: number;

  constructor(spec: BossSpec) {
    this.hp = spec.maxHp;
    this.maxHp = spec.maxHp;
    this.phases = spec.phases;
  }

  update(dt: number): void {
    this.timer += dt;
    if (this.state === "entering" && this.timer >= ENTRY_TIME) {
      this.state = "active";
      this.timer = 0;
    } else if (this.state === "phaseTransition" && this.timer >= TRANSITION_TIME) {
      this.state = "active";
      this.timer = 0;
    }
  }

  hit(amount: number): void {
    if (this.state !== "active") return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.state = "defeated";
      return;
    }
    // Phase thresholds split the HP bar evenly (phases-1 boundaries).
    const nextBoundaryPhase = this.phase + 1;
    if (nextBoundaryPhase <= this.phases) {
      const threshold = this.maxHp * (1 - (this.phase) / this.phases);
      if (this.hp <= threshold) {
        this.phase = nextBoundaryPhase;
        this.state = "phaseTransition";
        this.timer = 0;
      }
    }
  }

  isVulnerable(): boolean {
    return this.state === "active";
  }
}
