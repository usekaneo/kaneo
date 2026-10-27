import { describe, expect, it } from "vite-plus/test";
import { keepCurrentRule } from "./keep-current-rule.js";

const current = {
  frequency: "weekly",
  interval: 2,
  weekdays: [1, 4],
  timeZone: "Europe/Madrid",
} as const;

describe("keepCurrentRule", () => {
  it("keeps the rule when its frequency is picked again", () => {
    expect(
      keepCurrentRule({ picked: "weekly", current, ruleFlags: false }),
    ).toBe(current);
  });

  it("builds a new rule for another frequency or any rule flag", () => {
    expect(
      keepCurrentRule({ picked: "monthly", current, ruleFlags: false }),
    ).toBeNull();
    expect(
      keepCurrentRule({ picked: "weekly", current, ruleFlags: true }),
    ).toBeNull();
  });

  it("has nothing to keep on a task that does not repeat", () => {
    expect(
      keepCurrentRule({ picked: "weekly", current: null, ruleFlags: false }),
    ).toBeNull();
  });
});
