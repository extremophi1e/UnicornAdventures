import type { Vec2 } from "./types";

export function nearestEnemy(starPos: Vec2, enemies: Vec2[], maxDist: number): number {
  let best = -1;
  let bestD = maxDist * maxDist;
  for (let i = 0; i < enemies.length; i++) {
    const dx = enemies[i].x - starPos.x;
    const dy = enemies[i].y - starPos.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function steerVelocity(
  vel: Vec2,
  starPos: Vec2,
  target: Vec2,
  strength: number,
  dt: number,
): Vec2 {
  const speed = Math.hypot(vel.x, vel.y) || 1;
  const dx = target.x - starPos.x;
  const dy = target.y - starPos.y;
  const len = Math.hypot(dx, dy) || 1;
  // Blend current direction toward target direction.
  const t = Math.min(strength * dt, 1);
  const nx = vel.x / speed + (dx / len) * t;
  const ny = vel.y / speed + (dy / len) * t;
  const nlen = Math.hypot(nx, ny) || 1;
  return { x: (nx / nlen) * speed, y: (ny / nlen) * speed };
}
