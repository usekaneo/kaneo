import { describe, expect, it } from "vitest";
import { isReminderDue } from "../../../apps/api/src/scheduler/reminder-timing";

describe("isReminderDue", () => {
  const now = new Date("2026-07-12T10:00:00.000Z");

  it("matches a configured lead time", () => {
    expect(
      isReminderDue({
        dueDate: new Date("2026-07-14T10:00:00.000Z"),
        leadTimeMinutes: 2 * 24 * 60,
        now,
      }),
    ).toBe(true);
  });

  it("accepts scheduler runs within the ten minute delivery window", () => {
    expect(
      isReminderDue({
        dueDate: new Date("2026-07-13T09:55:00.000Z"),
        leadTimeMinutes: 24 * 60,
        now,
      }),
    ).toBe(true);
  });

  it("does not send before or after the delivery window", () => {
    expect(
      isReminderDue({
        dueDate: new Date("2026-07-13T10:05:00.000Z"),
        leadTimeMinutes: 24 * 60,
        now,
      }),
    ).toBe(false);
    expect(
      isReminderDue({
        dueDate: new Date("2026-07-13T09:49:00.000Z"),
        leadTimeMinutes: 24 * 60,
        now,
      }),
    ).toBe(false);
  });
});
