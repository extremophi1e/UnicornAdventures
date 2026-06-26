import type { Vec2 } from "./types";

export type AimInput = {
  pointer: Vec2 | null;
  keys: { left: boolean; right: boolean; up: boolean; down: boolean };
};
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function resolveTarget(
  current: Vec2,
  input: AimInput,
  keySpeed: number,
  dt: number,
  bounds: Bounds,
): Vec2 {
  if (input.pointer) {
    return {
      x: clamp(input.pointer.x, bounds.minX, bounds.maxX),
      y: clamp(input.pointer.y, bounds.minY, bounds.maxY),
    };
  }
  let { x, y } = current;
  const step = keySpeed * dt;
  if (input.keys.left) x -= step;
  if (input.keys.right) x += step;
  if (input.keys.up) y -= step;
  if (input.keys.down) y += step;
  return { x: clamp(x, bounds.minX, bounds.maxX), y: clamp(y, bounds.minY, bounds.maxY) };
}

export class AutoFire {
  private acc = 0;
  constructor(private intervalSec: number) {}
  update(dt: number): number {
    this.acc += dt;
    let shots = 0;
    while (this.acc >= this.intervalSec) {
      this.acc -= this.intervalSec;
      shots++;
    }
    return shots;
  }
  reset(): void {
    this.acc = 0;
  }
}
