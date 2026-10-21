import { describe, expect, it } from "vite-plus/test";
import { matchesCreatedDate } from "./matches-created-date";

const today = new Date(2026, 9, 21, 12);
const at = (month: number, day: number, hour = 12) =>
  new Date(2026, month, day, hour).toISOString();

describe("creation-date calendar presets", () => {
  it("includes the whole local day and excludes adjacent dates", () => {
    expect(matchesCreatedDate(at(9, 21, 0), "today", today, 1)).toBe(true);
    expect(matchesCreatedDate(at(9, 21, 23), "today", today, 1)).toBe(true);
    expect(matchesCreatedDate(at(9, 20, 23), "today", today, 1)).toBe(false);
    expect(matchesCreatedDate(at(9, 22, 0), "today", today, 1)).toBe(false);
  });

  it("respects the user's first day of the week", () => {
    expect(matchesCreatedDate(at(9, 18), "thisWeek", today, 0)).toBe(true);
    expect(matchesCreatedDate(at(9, 18), "thisWeek", today, 1)).toBe(false);
    expect(matchesCreatedDate(at(9, 19), "thisWeek", today, 1)).toBe(true);
  });

  it.each([
    ["last7Days", at(9, 15, 0), true],
    ["last7Days", at(9, 14, 23), false],
    ["last30Days", at(8, 22, 0), true],
    ["last30Days", at(8, 21, 23), false],
    ["last30Days", at(9, 22), false],
    ["unknown", at(9, 21), false],
    ["today", "invalid", false],
  ] as const)("matches %s against %s: %s", (preset, createdAt, expected) => {
    expect(matchesCreatedDate(createdAt, preset, today, 1)).toBe(expected);
  });

  it("uses calendar days across a daylight-saving transition", () => {
    const afterChange = new Date(2026, 2, 30, 12);
    expect(
      matchesCreatedDate(
        new Date(2026, 2, 24, 0).toISOString(),
        "last7Days",
        afterChange,
        1,
      ),
    ).toBe(true);
    expect(
      matchesCreatedDate(
        new Date(2026, 2, 23, 23).toISOString(),
        "last7Days",
        afterChange,
        1,
      ),
    ).toBe(false);
  });
});
