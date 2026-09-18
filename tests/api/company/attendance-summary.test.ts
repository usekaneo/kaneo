import { describe, expect, it } from "vitest";
import { summarizeDays } from "../../../apps/api/src/attendance/summary";
import { effectiveSchedule } from "../../../apps/api/src/company/schedule";

const schedule = effectiveSchedule({
  workDays: "7,1,2,3,4",
  workStart: "10:00",
  workEnd: "19:00",
  breakMinutes: 60,
});

describe("summarizeDays", () => {
  it("matches the plain-language example: 9h 16m worked, 16m overtime", () => {
    // Thursday 18 Sep 2026 in Dhaka (UTC+6): 10:02 → 19:18.
    const [day] = summarizeDays({
      days: ["2026-09-17"],
      sessions: [
        {
          id: "s1",
          clockIn: new Date("2026-09-17T04:02:00Z"),
          clockOut: new Date("2026-09-17T13:18:00Z"),
          source: "web",
          note: null,
        },
      ],
      activity: new Map([["2026-09-17", { active: 27_660, idle: 5_700 }]]),
      schedule,
      timeZone: "Asia/Dhaka",
      now: new Date("2026-09-17T20:00:00Z"),
    });

    expect(day).toMatchObject({
      workedMinutes: 556,
      overtimeMinutes: 16,
      scheduledMinutes: 540,
      activeSeconds: 27_660,
      idleSeconds: 5_700,
      open: false,
    });
    expect(day?.firstIn?.toISOString()).toBe("2026-09-17T04:02:00.000Z");
    expect(day?.lastOut?.toISOString()).toBe("2026-09-17T13:18:00.000Z");
  });

  it("adds up several sessions and counts an open one up to now", () => {
    const [day] = summarizeDays({
      days: ["2026-09-17"],
      sessions: [
        {
          id: "a",
          clockIn: new Date("2026-09-17T04:00:00Z"),
          clockOut: new Date("2026-09-17T07:00:00Z"),
          source: "web",
          note: null,
        },
        {
          id: "b",
          clockIn: new Date("2026-09-17T08:00:00Z"),
          clockOut: null,
          source: "web",
          note: null,
        },
      ],
      activity: new Map(),
      schedule,
      timeZone: "Asia/Dhaka",
      now: new Date("2026-09-17T09:30:00Z"),
    });

    expect(day?.workedMinutes).toBe(180 + 90);
    expect(day?.open).toBe(true);
    expect(day?.lastOut?.toISOString()).toBe("2026-09-17T07:00:00.000Z");
  });

  it("files a session under the local day it started", () => {
    // 23:30 local on the 17th is 17:30 UTC; it belongs to the 17th, not the 18th.
    const days = summarizeDays({
      days: ["2026-09-17", "2026-09-18"],
      sessions: [
        {
          id: "late",
          clockIn: new Date("2026-09-17T17:30:00Z"),
          clockOut: new Date("2026-09-17T19:30:00Z"),
          source: "web",
          note: null,
        },
      ],
      activity: new Map(),
      schedule,
      timeZone: "Asia/Dhaka",
      now: new Date("2026-09-18T12:00:00Z"),
    });

    expect(days.map((d) => d.workedMinutes)).toEqual([120, 0]);
  });
});

describe("summarizeDays statuses", () => {
  const session = (id: string, clockIn: string, clockOut: string) => ({
    id,
    clockIn: new Date(clockIn),
    clockOut: new Date(clockOut),
    source: "web",
    note: null,
  });

  // Thursday 17 Sep 2026, 12:00 in Dhaka. Sun–Thu work week, 10:00 start.
  const days = summarizeDays({
    days: [
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ],
    sessions: [
      // 10:08 local: inside the 10-minute grace.
      session("sun", "2026-09-13T04:08:00Z", "2026-09-13T13:00:00Z"),
      // 10:25 local: 25 minutes late.
      session("mon", "2026-09-14T04:25:00Z", "2026-09-14T13:00:00Z"),
    ],
    activity: new Map(),
    schedule,
    timeZone: "Asia/Dhaka",
    now: new Date("2026-09-17T06:00:00Z"),
    leaves: [
      { startDate: "2026-09-15", endDate: "2026-09-15", type: "sick" },
      // Leave over the weekend doesn't turn a day off into a leave day.
      { startDate: "2026-09-19", endDate: "2026-09-19", type: "annual" },
    ],
    lateGraceMinutes: 10,
  });
  const byDay = Object.fromEntries(days.map((d) => [d.day, d]));

  it("marks on-time, late, leave, absent, today, off and future days", () => {
    expect(days.map((d) => d.status)).toEqual([
      "present",
      "late",
      "leave",
      "absent",
      "pending",
      "off",
      "off",
      "upcoming",
    ]);
  });

  it("reports how late, only for late days", () => {
    expect(byDay["2026-09-13"]?.lateMinutes).toBe(0);
    expect(byDay["2026-09-14"]?.lateMinutes).toBe(25);
  });

  it("names the leave type only on working days", () => {
    expect(byDay["2026-09-15"]?.leaveType).toBe("sick");
    expect(byDay["2026-09-19"]?.leaveType).toBeNull();
  });

  it("doesn't call days before someone joined absent", () => {
    const [before, first] = summarizeDays({
      days: ["2026-09-15", "2026-09-16"],
      sessions: [],
      activity: new Map(),
      schedule,
      timeZone: "Asia/Dhaka",
      now: new Date("2026-09-17T06:00:00Z"),
      startDay: "2026-09-16",
    });
    expect(before?.status).toBe("notJoined");
    expect(first?.status).toBe("absent");
  });

  it("counts clocking in on a leave day as present", () => {
    const [day] = summarizeDays({
      days: ["2026-09-15"],
      sessions: [session("x", "2026-09-15T03:55:00Z", "2026-09-15T06:00:00Z")],
      activity: new Map(),
      schedule,
      timeZone: "Asia/Dhaka",
      now: new Date("2026-09-17T06:00:00Z"),
      leaves: [
        { startDate: "2026-09-15", endDate: "2026-09-15", type: "annual" },
      ],
    });
    expect(day?.status).toBe("present");
  });
});
