import { describe, expect, it } from "vite-plus/test";
import { followingRun, nextScheduledRun } from "./schedule";
import type { AutomationSchedule } from "./types";

const base: AutomationSchedule = {
  type: "schedule",
  frequency: "daily",
  time: "09:00",
  weekdays: [],
  intervalHours: null,
  timezone: "UTC",
};

describe("nextScheduledRun", () => {
  it("returns the next daily slot in UTC", () => {
    expect(
      nextScheduledRun(base, new Date("2026-03-10T08:59:00Z"))?.toISOString(),
    ).toBe("2026-03-10T09:00:00.000Z");
    expect(
      nextScheduledRun(base, new Date("2026-03-10T09:00:00Z"))?.toISOString(),
    ).toBe("2026-03-11T09:00:00.000Z");
  });

  it("keeps the local wall-clock time across DST changes", () => {
    const berlin = { ...base, timezone: "Europe/Berlin" };
    // CET (UTC+1) before 2026-03-29, CEST (UTC+2) after.
    expect(
      nextScheduledRun(berlin, new Date("2026-03-28T12:00:00Z"))?.toISOString(),
    ).toBe("2026-03-29T07:00:00.000Z");
    expect(
      nextScheduledRun(berlin, new Date("2026-03-27T12:00:00Z"))?.toISOString(),
    ).toBe("2026-03-28T08:00:00.000Z");
    const newYork = { ...base, timezone: "America/New_York", time: "16:00" };
    // EDT ends 2026-11-01.
    expect(
      nextScheduledRun(
        newYork,
        new Date("2026-10-31T21:00:00Z"),
      )?.toISOString(),
    ).toBe("2026-11-01T21:00:00.000Z");
  });

  it("runs a time skipped by spring-forward once, and a repeated time once", () => {
    const night = { ...base, time: "02:30", timezone: "Europe/Berlin" };
    // 02:30 does not exist on 2026-03-29; the slot moves to 03:00 CEST.
    expect(
      nextScheduledRun(night, new Date("2026-03-28T12:00:00Z"))?.toISOString(),
    ).toBe("2026-03-29T01:00:00.000Z");
    // 02:30 happens twice on 2026-10-25; only the first one runs.
    const first = nextScheduledRun(night, new Date("2026-10-24T12:00:00Z"));
    expect(first?.toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(nextScheduledRun(night, first as Date)?.toISOString()).toBe(
      "2026-10-26T01:30:00.000Z",
    );
  });

  it("only runs weekly schedules on the selected ISO weekdays", () => {
    const weekly: AutomationSchedule = {
      ...base,
      frequency: "weekly",
      weekdays: [1, 5],
      timezone: "Europe/Berlin",
    };
    // Tuesday 2026-10-27 → Friday 2026-10-30, 09:00 CET.
    expect(
      nextScheduledRun(weekly, new Date("2026-10-27T10:00:00Z"))?.toISOString(),
    ).toBe("2026-10-30T08:00:00.000Z");
    const sunday = { ...weekly, weekdays: [7] };
    expect(
      nextScheduledRun(sunday, new Date("2026-10-27T10:00:00Z"))?.toISOString(),
    ).toBe("2026-11-01T08:00:00.000Z");
  });

  it("adds whole hours for interval schedules", () => {
    const interval: AutomationSchedule = {
      ...base,
      frequency: "interval",
      intervalHours: 6,
    };
    expect(
      nextScheduledRun(
        interval,
        new Date("2026-10-27T10:00:00Z"),
      )?.toISOString(),
    ).toBe("2026-10-27T16:00:00.000Z");
  });
});

describe("followingRun", () => {
  it("skips missed slots instead of replaying them", () => {
    const next = followingRun(
      base,
      new Date("2026-03-01T09:00:00Z"),
      new Date("2026-03-10T12:00:00Z"),
    );
    expect(next?.toISOString()).toBe("2026-03-11T09:00:00.000Z");
  });

  it("continues from the slot when the tick is on time", () => {
    const next = followingRun(
      base,
      new Date("2026-03-10T09:00:00Z"),
      new Date("2026-03-10T09:00:30Z"),
    );
    expect(next?.toISOString()).toBe("2026-03-11T09:00:00.000Z");
  });
});
