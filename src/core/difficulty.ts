export function budgetForDepth(depth: number): number {
  // Gentle ramp: starts ~6, +1.5 per depth, capped so it never becomes chaotic.
  return Math.min(6 + Math.floor(depth * 1.5), 28);
}

export function typeCountForDepth(depth: number): number {
  if (depth < 3) return 1;
  if (depth < 7) return 2;
  return 3;
}
