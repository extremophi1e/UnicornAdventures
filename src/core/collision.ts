export type Circle = { x: number; y: number; r: number };
export type Hit = { starIndex: number; enemyIndex: number };

export function circleOverlap(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = a.r + b.r;
  return dx * dx + dy * dy <= rr * rr;
}

export function findStarEnemyHits(stars: Circle[], enemies: Circle[]): Hit[] {
  const hits: Hit[] = [];
  const usedEnemy = new Set<number>();
  for (let s = 0; s < stars.length; s++) {
    for (let e = 0; e < enemies.length; e++) {
      if (usedEnemy.has(e)) continue;
      if (circleOverlap(stars[s], enemies[e])) {
        hits.push({ starIndex: s, enemyIndex: e });
        usedEnemy.add(e);
        break; // each star consumed once
      }
    }
  }
  return hits;
}
