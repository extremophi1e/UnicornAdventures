import { describe, it, expect } from "vitest";
import { BossController } from "../../src/core/boss";

const spec = { type: "cupcake" as const, maxHp: 20, phases: 2 };

describe("BossController", () => {
  it("starts entering, then becomes active after entry time", () => {
    const b = new BossController(spec);
    expect(b.state).toBe("entering");
    expect(b.isVulnerable()).toBe(false);
    b.update(2); // entry completes
    expect(b.state).toBe("active");
    expect(b.isVulnerable()).toBe(true);
    expect(b.phase).toBe(1);
  });

  it("ignores hits until active", () => {
    const b = new BossController(spec);
    b.hit(5);
    expect(b.hp).toBe(20);
  });

  it("enters phaseTransition when crossing the halfway threshold", () => {
    const b = new BossController(spec);
    b.update(2);
    b.hit(11); // below 50% of 20
    expect(b.state).toBe("phaseTransition");
    expect(b.isVulnerable()).toBe(false);
    b.update(1); // transition completes
    expect(b.state).toBe("active");
    expect(b.phase).toBe(2);
  });

  it("is defeated at hp <= 0", () => {
    const b = new BossController(spec);
    b.update(2);
    b.hit(11);
    b.update(1);
    b.hit(99);
    expect(b.state).toBe("defeated");
    expect(b.hp).toBe(0);
  });
});
