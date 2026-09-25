import { describe, expect, it } from "vitest";
import { isReminderDue } from "../../../apps/api/src/scheduler/reminder-timing";

describe("isReminderDue", () => {
  const dueDate = new Date("2026-09-23T00:00:00.000Z");

  it.each([
    [
      "the previous day's incorrect reminder",
      "2026-09-22T10:00:00.000Z",
      false,
    ],
    ["before the reminder", "2026-09-23T09:59:59.999Z", false],
    [
      "exactly fourteen hours before expiration",
      "2026-09-23T10:00:00.000Z",
      true,
    ],
    ["a delayed scheduler run", "2026-09-23T10:05:00.000Z", true],
    ["the end of the delivery window", "2026-09-23T10:10:00.000Z", true],
    ["after the delivery window", "2026-09-23T10:10:00.001Z", false],
  ])("handles %s", (_description, now, expected) => {
    expect(
      isReminderDue({ dueDate, leadTimeMinutes: 14 * 60, now: new Date(now) }),
    ).toBe(expected);
  });

  it.each([
    ["2026-09-23T00:00:00.000Z", false],
    ["2026-09-23T23:59:59.999Z", false],
    ["2026-09-24T00:00:00.000Z", true],
  ])("uses next midnight for a zero lead time at %s", (now, expected) => {
    expect(
      isReminderDue({ dueDate, leadTimeMinutes: 0, now: new Date(now) }),
    ).toBe(expected);
  });

  it.each([
    ["2026-09-23T00:00:00.000Z", 24 * 60, "2026-09-23T00:00:00.000Z"],
    ["2026-09-23T00:00:00.000Z", 2 * 24 * 60, "2026-09-22T00:00:00.000Z"],
    ["2026-12-31T00:00:00.000Z", 0, "2027-01-01T00:00:00.000Z"],
    ["2028-02-29T00:00:00.000Z", 0, "2028-03-01T00:00:00.000Z"],
    ["2026-09-23T00:00:00+02:00", 14 * 60, "2026-09-23T10:00:00+02:00"],
    ["2026-09-23T00:00:00-07:00", 14 * 60, "2026-09-23T10:00:00-07:00"],
  ])(
    "handles due date %s with %i minutes lead time",
    (due, leadTimeMinutes, now) => {
      expect(
        isReminderDue({
          dueDate: new Date(due),
          leadTimeMinutes,
          now: new Date(now),
        }),
      ).toBe(true);
    },
  );
});
