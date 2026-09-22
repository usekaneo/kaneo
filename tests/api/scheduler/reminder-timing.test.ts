import { describe, expect, it } from "vitest";
import {
  getDueDateDeadline,
  isDueDateOverdue,
  isReminderDue,
} from "../../../apps/api/src/scheduler/reminder-timing";

describe("due date reminder timing", () => {
  const dueDate = new Date("2026-09-24T00:00:00.000Z");

  it("uses the next midnight as the deadline for a date-only due date", () => {
    expect(getDueDateDeadline(dueDate)).toEqual(
      new Date("2026-09-25T00:00:00.000Z"),
    );
  });

  it("matches a lead time relative to the end of the due date", () => {
    expect(
      isReminderDue({
        dueDate,
        leadTimeMinutes: 14 * 60,
        now: new Date("2026-09-24T10:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("does not send the reminder a calendar day early", () => {
    expect(
      isReminderDue({
        dueDate,
        leadTimeMinutes: 14 * 60,
        now: new Date("2026-09-23T10:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("accepts scheduler runs within the ten minute delivery window", () => {
    expect(
      isReminderDue({
        dueDate,
        leadTimeMinutes: 14 * 60,
        now: new Date("2026-09-24T10:05:00.000Z"),
      }),
    ).toBe(true);
  });

  it("does not send after the delivery window", () => {
    expect(
      isReminderDue({
        dueDate,
        leadTimeMinutes: 14 * 60,
        now: new Date("2026-09-24T10:11:00.000Z"),
      }),
    ).toBe(false);
  });

  it("keeps the task current for the whole due date", () => {
    expect(
      isDueDateOverdue({
        dueDate,
        now: new Date("2026-09-24T23:59:59.999Z"),
      }),
    ).toBe(false);
    expect(
      isDueDateOverdue({
        dueDate,
        now: new Date("2026-09-25T00:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
