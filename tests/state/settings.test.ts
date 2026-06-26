import { describe, it, expect, beforeEach } from "vitest";
import { settings } from "../../src/state/settings";

describe("settings", () => {
  beforeEach(() => {
    if (settings.calm) settings.toggleCalm();
  });
  it("defaults to calm = false (full juicy)", () => {
    expect(settings.calm).toBe(false);
  });
  it("toggles and notifies listeners", () => {
    let count = 0;
    settings.onChange(() => count++);
    settings.toggleCalm();
    expect(settings.calm).toBe(true);
    expect(count).toBe(1);
  });
});
