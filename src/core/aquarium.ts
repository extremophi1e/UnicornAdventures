// Pure, framework-free surprise engine for Tap the Aquarium. No Phaser imports
// — unit-tested headlessly with a seeded rng. This module is the single source
// of truth for WHICH reaction a tap triggers and HOW MANY creatures it adds.

export type ReactionTier = "common" | "uncommon" | "rare";
export type ReactionKind = "react" | "split" | "school";

export interface Reaction {
  id: string;
  tier: ReactionTier;
  kind: ReactionKind;     // "react" = non-additive; "split"/"school" = additive
  schoolCount?: number;   // creatures a "school" tries to add
}

// The full catalog (data, no behavior — the scene maps id -> visual effect).
export const REACTIONS: Reaction[] = [
  // Common — gentle, fires most taps.
  { id: "spin", tier: "common", kind: "react" },
  { id: "wiggle", tier: "common", kind: "react" },
  { id: "bubble", tier: "common", kind: "react" },
  { id: "squash", tier: "common", kind: "react" },
  { id: "colorflash", tier: "common", kind: "react" },
  { id: "heart", tier: "common", kind: "react" },
  // Uncommon — showy.
  { id: "split", tier: "uncommon", kind: "split" },
  { id: "bubblestream", tier: "uncommon", kind: "react" },
  { id: "zoom", tier: "uncommon", kind: "react" },
  { id: "morph", tier: "uncommon", kind: "react" },
  { id: "backflip", tier: "uncommon", kind: "react" },
  { id: "giant", tier: "uncommon", kind: "react" },
  // Rare — the big "whoa" jackpots.
  { id: "school", tier: "rare", kind: "school", schoolCount: 4 },
  { id: "shockwave", tier: "rare", kind: "react" },
  { id: "treasure", tier: "rare", kind: "react" },
];

export const TIER_WEIGHTS: Record<ReactionTier, number> = { common: 65, uncommon: 30, rare: 5 };
export const MIN_GAP = 6;        // taps since last rare before a rare is eligible
export const PITY_CEILING = 22;  // taps since last rare that force a rare next

export interface AquariumState {
  tapsSinceRare: number;
  lastReactionId: string | null;
}

export function initialAquariumState(): AquariumState {
  return { tapsSinceRare: 0, lastReactionId: null };
}

const TIER_ORDER: ReactionTier[] = ["common", "uncommon", "rare"];

function weightedTier(weights: Array<[ReactionTier, number]>, rng: () => number): ReactionTier {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [t, w] of weights) {
    if (roll < w) return t;
    roll -= w;
  }
  return weights[weights.length - 1][0]; // floating-point safety net
}

// Pick the next reaction. Pure + deterministic given `rng` (in [0,1)).
//   1. atCap -> drop additive reactions (split/school) from the pool first.
//   2. tier via pity/min-gap weighting (rare excluded below MIN_GAP, forced at PITY_CEILING).
//   3. uniform pick within the tier, excluding lastReactionId (no immediate repeat).
export function pickReaction(
  state: AquariumState,
  rng: () => number,
  opts: { atCap: boolean },
): { reaction: Reaction; state: AquariumState } {
  const pool = opts.atCap ? REACTIONS.filter((r) => r.kind === "react") : REACTIONS;
  const tiersPresent = new Set(pool.map((r) => r.tier));

  const rareEligible = tiersPresent.has("rare") && state.tapsSinceRare >= MIN_GAP;
  const forceRare = tiersPresent.has("rare") && state.tapsSinceRare >= PITY_CEILING;

  let tier: ReactionTier;
  if (forceRare) {
    tier = "rare";
  } else {
    const weights: Array<[ReactionTier, number]> = [];
    for (const t of TIER_ORDER) {
      if (!tiersPresent.has(t)) continue;
      if (t === "rare" && !rareEligible) continue; // redistribute by omission
      weights.push([t, TIER_WEIGHTS[t]]);
    }
    tier = weightedTier(weights, rng);
  }

  const inTier = pool.filter((r) => r.tier === tier);
  let candidates = inTier.filter((r) => r.id !== state.lastReactionId);
  if (candidates.length === 0) candidates = inTier; // single-member-tier edge
  const reaction = candidates[Math.floor(rng() * candidates.length)];

  return {
    reaction,
    state: {
      tapsSinceRare: tier === "rare" ? 0 : state.tapsSinceRare + 1,
      lastReactionId: reaction.id,
    },
  };
}

// How many creatures this reaction adds, clamped to remaining capacity.
export function netAdds(reaction: Reaction, remainingCapacity: number): number {
  if (remainingCapacity <= 0) return 0;
  if (reaction.kind === "split") return Math.min(1, remainingCapacity);
  if (reaction.kind === "school") return Math.min(reaction.schoolCount ?? 0, remainingCapacity);
  return 0;
}
