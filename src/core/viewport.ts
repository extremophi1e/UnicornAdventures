export const LOGICAL_HEIGHT = 1280;
// Lower bound lets tall phones (≈19.5–21:9, aspect ~0.43–0.46) use a logical
// width that matches their screen so Scale.FIT fills it with no letterbox bars.
// 0.46 phones land at ~591; the floor only protects ultra-narrow viewports.
const MIN_W = 520;
const MAX_W = 1100;

export function computeLogicalWidth(winW: number, winH: number): number {
  const target = Math.round(LOGICAL_HEIGHT * (winW / winH));
  return Math.max(MIN_W, Math.min(MAX_W, target));
}
