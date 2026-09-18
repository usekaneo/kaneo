import { describe, expect, it } from "vitest";
import {
  effectiveSchedule,
  paidMinutes,
  scheduledMinutes,
  workedAndOvertime,
} from "../../../apps/api/src/company/schedule";
import {
  addDays,
  isoWeekday,
  isValidTimeZone,
  weekStartDay,
  zonedDay,
  zonedDayRange,
  zonedInstant,
} from "../../../apps/api/src/company/zoned-time";

describe("zoned time", () => {
  it("reads the local day in the workspace timezone", () => {
    const instant = new Date("2026-09-18T20:30:00Z");
    expect(zonedDay(instant, "UTC")).toBe("2026-09-18");
    // Dhaka is UTC+6: 20:30 UTC is already the next morning there.
    expect(zonedDay(instant, "Asia/Dhaka")).toBe("2026-09-19");
    expect(zonedDay(instant, "America/New_York")).toBe("2026-09-18");
  });

  it("turns local wall-clock times into instants", () => {
    expect(
      zonedInstant("2026-09-18", "10:00", "Asia/Dhaka").toISOString(),
    ).toBe("2026-09-18T04:00:00.000Z");
    const { start, end } = zonedDayRange("2026-09-18", "Asia/Dhaka");
    expect(start.toISOString()).toBe("2026-09-17T18:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-18T18:00:00.000Z");
  });

  it("handles days that are 23 hours long around a DST change", () => {
    const { start, end } = zonedDayRange("2026-03-08", "America/New_York");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it("does week and weekday arithmetic on plain dates", () => {
    expect(isoWeekday("2026-09-18")).toBe(5);
    expect(isoWeekday("2026-09-20")).toBe(7);
    expect(weekStartDay("2026-09-20")).toBe("2026-09-14");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("rejects unknown timezones", () => {
    expect(isValidTimeZone("Asia/Dhaka")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});

describe("schedule", () => {
  const company = {
    workDays: "1,2,3,4,5",
    workStart: "10:00",
    workEnd: "19:00",
    breakMinutes: 60,
  };

  it("expects 10:00–19:00 on work days and nothing on days off", () => {
    const schedule = effectiveSchedule(company);
    expect(scheduledMinutes(schedule, "2026-09-18")).toBe(540);
    expect(paidMinutes(schedule, "2026-09-18")).toBe(480);
    expect(scheduledMinutes(schedule, "2026-09-19")).toBe(0);
    expect(paidMinutes(schedule, "2026-09-19")).toBe(0);
  });

  it("applies a person's override on top of the company schedule", () => {
    const schedule = effectiveSchedule(company, {
      workDays: "1,2,3,4,5,6",
      workStart: null,
      workEnd: "15:00",
      breakMinutes: 30,
    });
    expect(scheduledMinutes(schedule, "2026-09-19")).toBe(300);
    expect(paidMinutes(schedule, "2026-09-19")).toBe(270);
  });

  it("counts time past the schedule as overtime", () => {
    const schedule = effectiveSchedule(company);
    // 10:02 → 19:18 is 9h 16m at work: 16 minutes over a 9 hour day.
    expect(workedAndOvertime(schedule, "2026-09-18", 556)).toEqual({
      worked: 556,
      overtime: 16,
    });
    expect(workedAndOvertime(schedule, "2026-09-18", 240)).toEqual({
      worked: 240,
      overtime: 0,
    });
    // Anything on a day off is overtime.
    expect(workedAndOvertime(schedule, "2026-09-19", 120)).toEqual({
      worked: 120,
      overtime: 120,
    });
  });
});
