import { describe, expect, it } from "vite-plus/test";
import {
  nextOccurrenceDate,
  nextOccurrenceDates,
} from "./next-occurrence-date";
import type { TaskRecurrence } from "./schema";

const rule = (
  frequency: TaskRecurrence["frequency"],
  interval = 1,
  timeZone = "UTC",
  weekdays?: number[],
): TaskRecurrence => ({ frequency, interval, timeZone, weekdays });

const next = (iso: string, recurrence: TaskRecurrence) =>
  nextOccurrenceDate(new Date(iso), recurrence).toISOString();

describe("nextOccurrenceDate", () => {
  it("moves the date by the interval of each frequency", () => {
    expect(next("2026-03-10T09:00:00.000Z", rule("daily"))).toBe(
      "2026-03-11T09:00:00.000Z",
    );
    expect(next("2026-03-10T09:00:00.000Z", rule("daily", 3))).toBe(
      "2026-03-13T09:00:00.000Z",
    );
    expect(next("2026-03-10T09:00:00.000Z", rule("weekly", 2))).toBe(
      "2026-03-24T09:00:00.000Z",
    );
    expect(next("2026-03-10T09:00:00.000Z", rule("monthly", 3))).toBe(
      "2026-06-10T09:00:00.000Z",
    );
    expect(next("2026-03-10T09:00:00.000Z", rule("yearly"))).toBe(
      "2027-03-10T09:00:00.000Z",
    );
  });

  it("clamps to the last day of shorter months", () => {
    expect(next("2026-01-31T00:00:00.000Z", rule("monthly"))).toBe(
      "2026-02-28T00:00:00.000Z",
    );
    expect(next("2028-01-31T00:00:00.000Z", rule("monthly"))).toBe(
      "2028-02-29T00:00:00.000Z",
    );
    expect(next("2028-02-29T00:00:00.000Z", rule("yearly"))).toBe(
      "2029-02-28T00:00:00.000Z",
    );
  });

  it("keeps local midnight across daylight saving changes", () => {
    // Midnight in Madrid is 22:00 UTC in summer and 23:00 UTC in winter.
    expect(
      next("2026-10-19T22:00:00.000Z", rule("weekly", 1, "Europe/Madrid")),
    ).toBe("2026-10-26T23:00:00.000Z");
    expect(
      next("2026-03-25T23:00:00.000Z", rule("weekly", 1, "Europe/Madrid")),
    ).toBe("2026-04-01T22:00:00.000Z");
    // Jan 31 in Madrid starts at 23:00 UTC on Jan 30.
    expect(
      next("2026-01-30T23:00:00.000Z", rule("monthly", 1, "Europe/Madrid")),
    ).toBe("2026-02-27T23:00:00.000Z");
  });

  // 2026-10-05 is a Monday; weekdays count from 0 for Sunday.
  it("moves to the next selected weekday in the same week", () => {
    const monFri = rule("weekly", 1, "UTC", [1, 5]);
    expect(next("2026-10-05T09:00:00.000Z", monFri)).toBe(
      "2026-10-09T09:00:00.000Z",
    );
    expect(next("2026-10-09T09:00:00.000Z", monFri)).toBe(
      "2026-10-12T09:00:00.000Z",
    );
  });

  it("skips ahead by the interval after the last selected weekday", () => {
    const everyOtherMonFri = rule("weekly", 2, "UTC", [5, 1]);
    expect(next("2026-10-05T09:00:00.000Z", everyOtherMonFri)).toBe(
      "2026-10-09T09:00:00.000Z",
    );
    expect(next("2026-10-09T09:00:00.000Z", everyOtherMonFri)).toBe(
      "2026-10-19T09:00:00.000Z",
    );
    // Sunday ends the Monday-based week.
    expect(
      next("2026-10-11T09:00:00.000Z", rule("weekly", 1, "UTC", [0])),
    ).toBe("2026-10-18T09:00:00.000Z");
  });

  it("uses the local weekday of the rule's time zone", () => {
    // Friday 00:00 in Madrid is still Thursday in UTC.
    expect(
      next(
        "2026-10-08T22:00:00.000Z",
        rule("weekly", 1, "Europe/Madrid", [1, 5]),
      ),
    ).toBe("2026-10-11T22:00:00.000Z");
  });
});

describe("nextOccurrenceDates", () => {
  it("keeps the gap between the start and due dates", () => {
    const dates = nextOccurrenceDates(
      {
        startDate: new Date("2026-10-05T00:00:00.000Z"),
        dueDate: new Date("2026-10-09T00:00:00.000Z"),
      },
      rule("weekly", 1, "UTC", [5]),
      new Date("2026-10-09T15:00:00.000Z"),
    );
    expect(dates).toEqual({
      startDate: new Date("2026-10-12T00:00:00.000Z"),
      dueDate: new Date("2026-10-16T00:00:00.000Z"),
    });
  });

  it("repeats from the completion time when there is no due date", () => {
    const dates = nextOccurrenceDates(
      { startDate: new Date("2026-10-05T00:00:00.000Z"), dueDate: null },
      rule("daily", 2),
      new Date("2026-10-09T15:00:00.000Z"),
    );
    expect(dates).toEqual({
      startDate: null,
      dueDate: new Date("2026-10-11T15:00:00.000Z"),
    });
  });
});
