export const LOGICAL_HEIGHT = 1280;
const MIN_W = 720;
const MAX_W = 1100;

export function computeLogicalWidth(winW: number, winH: number): number {
  const target = Math.round(LOGICAL_HEIGHT * (winW / winH));
  return Math.max(MIN_W, Math.min(MAX_W, target));
}
