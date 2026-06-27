// Pure, framework-free "surprise" picker for Unicorn Gumballs. No Phaser imports;
// unit-tested headlessly. A shuffle-bag gives no-immediate-repeat cuties with
// bounded droughts; the unicorn jackpot is a gated periodic surprise.

// Ordinary cuties — keys from src/render/emoji.ts (icecream/donut/cupcake/lollipop
// render tulip/ladybug/clover/cat).
export const GUMBALL_ITEMS: readonly string[] = [
  "star", "heart", "flower", "butterfly", "gem", "balloon",
  "icecream", "donut", "cupcake", "lollipop", "cloud",
];
export const JACKPOT = "unicorn";   // special: rendered from the catchUnicorn sheet
export const JACKPOT_MIN_GAP = 8;   // ordinary pulls required before a jackpot is eligible
export const JACKPOT_CHANCE = 0.10; // per-eligible-pull probability (~1 in 16 overall)

export interface Bag {
  next(): string;
}

function shuffle(items: readonly string[], rng: () => number): string[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

export function createBag(rng: () => number): Bag {
  let bag: string[] = [];
  let last: string | null = null;
  let sinceJackpot = 0;

  const drawCutie = (): string => {
    if (bag.length === 0) {
      bag = shuffle(GUMBALL_ITEMS, rng);
      // De-seam: the item we're about to draw (end of the array) must not repeat
      // the previous draw across a refill boundary. Swap it with any item that
      // differs from `last` (robust even if the item list ever has duplicates;
      // for the current distinct list, `alt` is simply index 0).
      if (bag.length > 1 && bag[bag.length - 1] === last) {
        const alt = bag.findIndex((x) => x !== last);
        if (alt !== -1) {
          const t = bag[bag.length - 1]; bag[bag.length - 1] = bag[alt]; bag[alt] = t;
        }
      }
    }
    const x = bag.pop() as string;
    last = x;
    return x;
  };

  return {
    next(): string {
      if (sinceJackpot >= JACKPOT_MIN_GAP && rng() < JACKPOT_CHANCE) {
        sinceJackpot = 0;
        return JACKPOT;
      }
      sinceJackpot += 1;
      return drawCutie();
    },
  };
}
