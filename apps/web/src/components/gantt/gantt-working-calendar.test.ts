import { describe, expect, it } from "vitest";
import {
  buildHolidayDateKeySet,
  DEFAULT_WORKING_DAYS,
  isWorkingDay,
  toDateKey,
} from "./gantt-working-calendar";

// 2026-01-01 is a Thursday, so this fixed week gives one of every weekday:
// Sat 2026-01-03, Sun 2026-01-04, Mon 2026-01-05, ... Fri 2026-01-09.
function localDay(day: number): Date {
  return new Date(2026, 0, day);
}

describe("toDateKey", () => {
  it("formats using local calendar components, zero-padded", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateKey(new Date(2026, 10, 3))).toBe("2026-11-03");
  });
});

describe("buildHolidayDateKeySet", () => {
  it("reads the ISO string's date part directly, ignoring time-of-day", () => {
    const set = buildHolidayDateKeySet([
      { date: "2026-01-03T00:00:00.000Z" },
      { date: "2026-12-25T00:00:00.000Z" },
    ]);
    expect(set.has("2026-01-03")).toBe(true);
    expect(set.has("2026-12-25")).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe("isWorkingDay", () => {
  const noHolidays = new Set<string>();

  it("treats Mon-Fri as working under the default bitmask", () => {
    for (const day of [5, 6, 7, 8, 9]) {
      expect(
        isWorkingDay(localDay(day), DEFAULT_WORKING_DAYS, noHolidays),
      ).toBe(true);
    }
  });

  it("treats Sat/Sun as non-working under the default bitmask", () => {
    expect(isWorkingDay(localDay(3), DEFAULT_WORKING_DAYS, noHolidays)).toBe(
      false,
    );
    expect(isWorkingDay(localDay(4), DEFAULT_WORKING_DAYS, noHolidays)).toBe(
      false,
    );
  });

  it("honors a custom bitmask (e.g. Sunday+Monday off instead of Sat+Sun)", () => {
    // Tue..Sat working: bits 2,3,4,5,6 set = 0b1111100 = 124.
    const workingDays = 0b1111100;
    expect(isWorkingDay(localDay(3), workingDays, noHolidays)).toBe(true); // Sat
    expect(isWorkingDay(localDay(4), workingDays, noHolidays)).toBe(false); // Sun
    expect(isWorkingDay(localDay(5), workingDays, noHolidays)).toBe(false); // Mon
    expect(isWorkingDay(localDay(6), workingDays, noHolidays)).toBe(true); // Tue
  });

  it("a holiday overrides an otherwise-working weekday", () => {
    const holidays = buildHolidayDateKeySet([
      { date: "2026-01-05T00:00:00.000Z" },
    ]);
    // Monday, normally working, but it's a holiday.
    expect(isWorkingDay(localDay(5), DEFAULT_WORKING_DAYS, holidays)).toBe(
      false,
    );
    // Adjacent Tuesday is unaffected.
    expect(isWorkingDay(localDay(6), DEFAULT_WORKING_DAYS, holidays)).toBe(
      true,
    );
  });

  it("a holiday on a weekend is redundant but still non-working", () => {
    const holidays = buildHolidayDateKeySet([
      { date: "2026-01-03T00:00:00.000Z" },
    ]);
    expect(isWorkingDay(localDay(3), DEFAULT_WORKING_DAYS, holidays)).toBe(
      false,
    );
  });
});
