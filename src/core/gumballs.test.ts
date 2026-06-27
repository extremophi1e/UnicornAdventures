import { describe, it, expect } from "vitest";
import { createBag, GUMBALL_ITEMS, JACKPOT, JACKPOT_MIN_GAP, JACKPOT_CHANCE } from "./gumballs";
import { createRng } from "./rng";

describe("createBag", () => {
  it("never returns the same value twice in a row", () => {
    const bag = createBag(Math.random);
    let prev = "";
    for (let i = 0; i < 1000; i++) {
      const x = bag.next();
      expect(x).not.toBe(prev);
      prev = x;
    }
  });

  it("never repeats across thousands of deterministic draws (exercises the refill de-seam)", () => {
    // Seeded RNG -> deterministic. 5000 draws span hundreds of bag refills, so the
    // refill de-seam (next-to-draw === previous draw) is hit dozens of times; a
    // broken de-seam would surface here as an immediate repeat.
    const bag = createBag(createRng(98765));
    let prev = "";
    for (let i = 0; i < 5000; i++) {
      const x = bag.next();
      expect(x).not.toBe(prev);
      prev = x;
    }
  });

  it("eventually yields every ordinary cutie", () => {
    const bag = createBag(Math.random);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const x = bag.next();
      if (x !== JACKPOT) seen.add(x);
    }
    for (const id of GUMBALL_ITEMS) expect(seen.has(id)).toBe(true);
  });

  it("never gives a jackpot before JACKPOT_MIN_GAP ordinary pulls, then does when eligible", () => {
    const bag = createBag(() => 0); // 0 < JACKPOT_CHANCE, so jackpot fires as soon as eligible
    const out: string[] = [];
    for (let i = 0; i < 12; i++) out.push(bag.next());
    // first JACKPOT_MIN_GAP draws are ordinary, the next is the jackpot
    for (let i = 0; i < JACKPOT_MIN_GAP; i++) expect(out[i]).not.toBe(JACKPOT);
    expect(out[JACKPOT_MIN_GAP]).toBe(JACKPOT);
  });

  it("never fires a jackpot when rng is above the chance", () => {
    const bag = createBag(() => 0.5); // 0.5 > JACKPOT_CHANCE
    expect(0.5).toBeGreaterThan(JACKPOT_CHANCE);
    for (let i = 0; i < 60; i++) expect(bag.next()).not.toBe(JACKPOT);
  });

  it("never returns two jackpots back to back", () => {
    const bag = createBag(() => 0); // greedy jackpots whenever eligible
    let prevWasJackpot = false;
    for (let i = 0; i < 60; i++) {
      const isJackpot = bag.next() === JACKPOT;
      expect(isJackpot && prevWasJackpot).toBe(false);
      prevWasJackpot = isJackpot;
    }
  });
});
