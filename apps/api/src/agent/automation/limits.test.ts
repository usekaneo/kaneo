import { describe, expect, it } from "vite-plus/test";
import {
  AUTOMATION_BATCH_WINDOW_MS,
  isBatchReady,
  parseMonthlyBudget,
  startOfUtcMonth,
} from "./limits";

describe("automation limits", () => {
  it("closes a batch five minutes after its first event", () => {
    const first = new Date("2026-10-27T10:00:00Z");
    expect(isBatchReady(first, new Date("2026-10-27T10:04:59Z"))).toBe(false);
    expect(
      isBatchReady(
        first,
        new Date(first.getTime() + AUTOMATION_BATCH_WINDOW_MS),
      ),
    ).toBe(true);
  });

  it("starts budget months at UTC midnight on the first", () => {
    expect(
      startOfUtcMonth(new Date("2026-10-31T23:30:00-05:00")).toISOString(),
    ).toBe("2026-11-01T00:00:00.000Z");
    expect(
      startOfUtcMonth(new Date("2026-10-15T08:00:00Z")).toISOString(),
    ).toBe("2026-10-01T00:00:00.000Z");
  });

  it("allows an unset budget and fails closed on invalid configuration", () => {
    expect(parseMonthlyBudget(undefined)).toBeNull();
    expect(parseMonthlyBudget("")).toBeNull();
    expect(parseMonthlyBudget("abc")).toBe(0);
    expect(parseMonthlyBudget("-1")).toBe(0);
    expect(parseMonthlyBudget("25.5")).toBe(25.5);
    expect(parseMonthlyBudget("0")).toBe(0);
  });
});
