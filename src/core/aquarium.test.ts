import { describe, it, expect } from "vitest";
import {
  pickReaction, netAdds, initialAquariumState, REACTIONS,
  MIN_GAP, PITY_CEILING, type AquariumState, type Reaction,
} from "./aquarium";

// Small deterministic RNG (mulberry32) for seeded distribution tests.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const byId = (id: string) => REACTIONS.find((r) => r.id === id) as Reaction;

describe("REACTIONS catalog", () => {
  it("has 6 common, 6 uncommon, 3 rare", () => {
    expect(REACTIONS.filter((r) => r.tier === "common")).toHaveLength(6);
    expect(REACTIONS.filter((r) => r.tier === "uncommon")).toHaveLength(6);
    expect(REACTIONS.filter((r) => r.tier === "rare")).toHaveLength(3);
  });
  it("marks split as kind 'split' and school as kind 'school'", () => {
    expect(byId("split").kind).toBe("split");
    expect(byId("school").kind).toBe("school");
    expect(byId("school").schoolCount).toBeGreaterThan(0);
  });
});

describe("pickReaction — pity ceiling", () => {
  it("forces a rare once tapsSinceRare hits PITY_CEILING", () => {
    const state: AquariumState = { tapsSinceRare: PITY_CEILING, lastReactionId: null };
    const { reaction } = pickReaction(state, () => 0, { atCap: false });
    expect(reaction.tier).toBe("rare");
  });
  it("resets tapsSinceRare to 0 after a rare and increments otherwise", () => {
    const rare = pickReaction({ tapsSinceRare: PITY_CEILING, lastReactionId: null }, () => 0, { atCap: false });
    expect(rare.state.tapsSinceRare).toBe(0);
    const common = pickReaction({ tapsSinceRare: 3, lastReactionId: null }, () => 0, { atCap: false });
    expect(common.state.tapsSinceRare).toBe(4);
  });
});

describe("pickReaction — min-gap", () => {
  it("never returns a rare while tapsSinceRare < MIN_GAP, across many rng values", () => {
    for (let g = 0; g < MIN_GAP; g++) {
      for (let r = 0; r < 50; r++) {
        const rng = () => r / 50; // sweep [0,1)
        const { reaction } = pickReaction({ tapsSinceRare: g, lastReactionId: null }, rng, { atCap: false });
        expect(reaction.tier).not.toBe("rare");
      }
    }
  });
  it("does not fire a rare immediately after a rare (gap resets to 0)", () => {
    let state = pickReaction({ tapsSinceRare: PITY_CEILING, lastReactionId: null }, () => 0, { atCap: false }).state;
    const next = pickReaction(state, () => 0.999, { atCap: false });
    expect(next.reaction.tier).not.toBe("rare");
  });
});

describe("pickReaction — cap filter", () => {
  it("never returns an additive reaction (split/school) when atCap", () => {
    const rng = mulberry32(1);
    let state = initialAquariumState();
    for (let i = 0; i < 2000; i++) {
      const res = pickReaction(state, rng, { atCap: true });
      expect(res.reaction.kind).toBe("react");
      expect(["split", "school"]).not.toContain(res.reaction.id);
      state = res.state;
    }
  });
  it("can still force a (non-additive) rare at cap via pity", () => {
    const { reaction } = pickReaction({ tapsSinceRare: PITY_CEILING, lastReactionId: null }, () => 0, { atCap: true });
    expect(reaction.tier).toBe("rare");
    expect(reaction.kind).toBe("react"); // school filtered out; shockwave/treasure remain
  });
});

describe("pickReaction — no immediate repeat", () => {
  it("never returns the same id twice in a row over a long seeded run", () => {
    const rng = mulberry32(42);
    let state = initialAquariumState();
    let last: string | null = null;
    for (let i = 0; i < 3000; i++) {
      const res = pickReaction(state, rng, { atCap: false });
      if (last !== null) expect(res.reaction.id).not.toBe(last);
      last = res.reaction.id;
      state = res.state;
    }
  });
});

describe("pickReaction — tier distribution (sanity)", () => {
  it("is roughly 65/30/5 over many seeded draws", () => {
    const rng = mulberry32(7);
    let state = initialAquariumState();
    const counts = { common: 0, uncommon: 0, rare: 0 };
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const res = pickReaction(state, rng, { atCap: false });
      counts[res.reaction.tier]++;
      state = res.state;
    }
    expect(counts.common / N).toBeGreaterThan(0.55);
    expect(counts.common / N).toBeLessThan(0.75);
    expect(counts.uncommon / N).toBeGreaterThan(0.22);
    expect(counts.uncommon / N).toBeLessThan(0.38);
    expect(counts.rare / N).toBeGreaterThan(0.02);
    expect(counts.rare / N).toBeLessThan(0.10);
  });
});

describe("netAdds", () => {
  it("returns 1 for split with room, 0 with no room", () => {
    expect(netAdds(byId("split"), 5)).toBe(1);
    expect(netAdds(byId("split"), 0)).toBe(0);
  });
  it("clamps school to remaining capacity", () => {
    expect(netAdds(byId("school"), 10)).toBe(byId("school").schoolCount);
    expect(netAdds(byId("school"), 2)).toBe(2);
  });
  it("returns 0 for non-additive reactions", () => {
    expect(netAdds(byId("spin"), 10)).toBe(0);
    expect(netAdds(byId("shockwave"), 10)).toBe(0);
  });
});
