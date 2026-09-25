import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  parseISO,
  subDays,
} from "date-fns";
import { describe, expect, it } from "vitest";
import {
  alignRangeStartToUnit,
  buildGanttHeaderColumns,
  buildGanttRange,
  buildGanttTimeline,
  deriveTaskSchedule,
  GANTT_UNIT_WINDOW_DAYS,
  GANTT_WINDOW_DAYS,
  getBarGridColumns,
  parseTaskDate,
} from "./timeline";

const span = (start: string, end = start) => ({
  scheduleStart: parseISO(start),
  scheduleEnd: parseISO(end),
});

describe("bounded Gantt timeline", () => {
  it("bounds allocation even for one task spanning years 0001 through 9999", () => {
    const timeline = buildGanttTimeline(
      [span("0001-01-01", "9999-12-31")],
      1,
      2.75,
      null,
      parseISO("2026-09-19"),
    );
    expect(timeline?.days).toHaveLength(GANTT_WINDOW_DAYS);
    expect(timeline?.rangeStart.getFullYear()).toBe(2026);
    expect(timeline?.timelineMinWidthRem).toBe(GANTT_WINDOW_DAYS * 2.75);
  });
  it("bounds separate distant tasks and supports jumping directly to either endpoint", () => {
    const tasks = [span("0001-01-01"), span("9999-12-31")];
    for (const date of ["0001-01-01", "9999-12-31"]) {
      const timeline = buildGanttTimeline(tasks, 1, 3, parseISO(date));
      expect(timeline?.days.length).toBeLessThanOrEqual(GANTT_WINDOW_DAYS);
      expect(
        timeline?.days.every((day) => Number.isFinite(day.getTime())),
      ).toBe(true);
      expect(parseISO(date).getTime()).toBeGreaterThanOrEqual(
        timeline?.rangeStart.getTime() ?? 0,
      );
      expect(parseISO(date).getTime()).toBeLessThanOrEqual(
        timeline?.rangeEnd.getTime() ?? 0,
      );
    }
  });
  it("retains week padding for a small normal schedule", () => {
    const timeline = buildGanttTimeline(
      [span("2026-09-14", "2026-09-18")],
      1,
      3,
    );
    expect(timeline?.rangeStart).toEqual(parseISO("2026-09-07"));
    expect(timeline?.rangeEnd).toEqual(parseISO("2026-10-18"));
    expect(timeline?.hasPrevious).toBe(false);
    expect(timeline?.hasNext).toBe(false);
  });
  it("pages a long project without gaps and stops at the final window", () => {
    const tasks = [span("2026-01-01", "2027-12-31")];
    let timeline = buildGanttTimeline(tasks, 0, 3, parseISO("2026-01-01"));
    for (let page = 0; page < 12 && timeline?.hasNext; page++) {
      const previous = timeline;
      timeline = buildGanttTimeline(
        tasks,
        0,
        3,
        addDays(previous.rangeStart, GANTT_WINDOW_DAYS),
      );
      expect(
        differenceInCalendarDays(
          timeline?.rangeStart ?? new Date(),
          previous.rangeEnd,
        ),
      ).toBeLessThanOrEqual(1);
      expect(timeline?.days.length).toBeLessThanOrEqual(GANTT_WINDOW_DAYS);
    }
    expect(timeline?.hasNext).toBe(false);
    expect(timeline?.rangeStart).toEqual(timeline?.maximumStart);
  });
  it.each([null, "invalid", "+275760-09-13", "-000001-01-01"])(
    "ignores unsupported legacy dates safely (%s)",
    (value) => {
      expect(parseTaskDate(value)).toBeNull();
    },
  );
});

describe("buildGanttRange extraBoundsTasks (external related tasks)", () => {
  it("widens minimumStart/maximumStart/maximumEnd to reach a bounds task dated outside the own tasks' span, without moving the default page", () => {
    const ownTasks = [span("2026-09-14", "2026-09-18")];
    const withoutExternal = buildGanttRange(
      ownTasks,
      1,
      null,
      parseISO("2026-09-20"),
    );
    const farFutureExternal = [span("2027-06-01", "2027-06-05")];
    const withExternal = buildGanttRange(
      ownTasks,
      1,
      null,
      parseISO("2026-09-20"),
      "day",
      farFutureExternal,
    );

    // The default page (no explicit requestedStart) is unchanged: an
    // out-of-window external task never shifts where the chart first opens.
    expect(withExternal?.rangeStart).toEqual(withoutExternal?.rangeStart);
    // But the reachable bound now extends far enough to actually page or
    // jump to the external task's own date.
    expect(
      (withExternal?.maximumStart.getTime() ?? 0) >
        (withoutExternal?.maximumStart.getTime() ?? 0),
    ).toBe(true);
    // Jumping toward the external task's own date (e.g. the "show task
    // dates" affordance) actually reaches a window that contains it, once
    // the bounds are widened — the exact requested day may still get
    // clamped to `maximumStart`, but the resulting window covers the
    // external task either way.
    const externalStart = parseISO("2027-06-01");
    const jumpWithoutExternal = buildGanttRange(
      ownTasks,
      1,
      subDays(externalStart, 7),
      parseISO("2026-09-20"),
    );
    expect(
      (jumpWithoutExternal?.rangeStart.getTime() ?? 0) <=
        externalStart.getTime() &&
        externalStart.getTime() <=
          (jumpWithoutExternal?.rangeEnd.getTime() ?? 0),
    ).toBe(false);

    const jumpWithExternal = buildGanttRange(
      ownTasks,
      1,
      subDays(externalStart, 7),
      parseISO("2026-09-20"),
      "day",
      farFutureExternal,
    );
    expect(
      (jumpWithExternal?.rangeStart.getTime() ?? 0) <=
        externalStart.getTime() &&
        externalStart.getTime() <= (jumpWithExternal?.rangeEnd.getTime() ?? 0),
    ).toBe(true);
  });

  it("without any bounds tasks, behaves exactly as before (bounds tasks default to none)", () => {
    const ownTasks = [span("2026-09-14", "2026-09-18")];
    const explicit = buildGanttRange(
      ownTasks,
      1,
      null,
      parseISO("2026-09-20"),
      "day",
      [],
    );
    const implicit = buildGanttRange(ownTasks, 1, null, parseISO("2026-09-20"));
    expect(explicit).toEqual(implicit);
  });
});

describe("getBarGridColumns", () => {
  const rangeStart = parseISO("2026-09-01");

  it("places a bar fully inside the window on the matching grid lines", () => {
    const result = getBarGridColumns(
      parseISO("2026-09-03"),
      parseISO("2026-09-05"),
      rangeStart,
      10,
    );
    expect(result).toEqual({ barInView: true, lineStart: 3, lineEnd: 6 });
  });

  it("clips a bar that starts before the window to the first line", () => {
    const result = getBarGridColumns(
      parseISO("2026-08-25"),
      parseISO("2026-09-03"),
      rangeStart,
      10,
    );
    expect(result.barInView).toBe(true);
    expect(result.lineStart).toBe(1);
    expect(result.lineEnd).toBe(4);
  });

  it("clips a bar that ends after the window to the last line", () => {
    const result = getBarGridColumns(
      parseISO("2026-09-08"),
      parseISO("2026-09-30"),
      rangeStart,
      10,
    );
    expect(result.barInView).toBe(true);
    expect(result.lineEnd).toBe(11);
  });

  it("reports out of view for a bar entirely before the window", () => {
    const result = getBarGridColumns(
      parseISO("2026-08-01"),
      parseISO("2026-08-20"),
      rangeStart,
      10,
    );
    expect(result.barInView).toBe(false);
  });

  it("reports out of view for a bar entirely after the window", () => {
    const result = getBarGridColumns(
      parseISO("2026-10-01"),
      parseISO("2026-10-05"),
      rangeStart,
      10,
    );
    expect(result.barInView).toBe(false);
  });

  it("places a single-day span (e.g. a milestone) on exactly one grid line", () => {
    const result = getBarGridColumns(
      parseISO("2026-09-05"),
      parseISO("2026-09-05"),
      rangeStart,
      10,
    );
    expect(result).toEqual({ barInView: true, lineStart: 5, lineEnd: 6 });
  });

  it("reports out of view for an empty track", () => {
    const result = getBarGridColumns(
      parseISO("2026-09-03"),
      parseISO("2026-09-05"),
      rangeStart,
      0,
    );
    expect(result.barInView).toBe(false);
  });
});

describe("deriveTaskSchedule", () => {
  it("returns null when neither date is set (unpositionable)", () => {
    expect(deriveTaskSchedule(null, null)).toBeNull();
  });

  it("falls back to the one date present for a single-day schedule", () => {
    expect(deriveTaskSchedule("2026-09-10", null)).toEqual({
      start: parseISO("2026-09-10"),
      end: parseISO("2026-09-10"),
    });
    expect(deriveTaskSchedule(null, "2026-09-12")).toEqual({
      start: parseISO("2026-09-12"),
      end: parseISO("2026-09-12"),
    });
  });

  it("normalizes a due date that precedes the start date", () => {
    expect(deriveTaskSchedule("2026-09-20", "2026-09-10")).toEqual({
      start: parseISO("2026-09-10"),
      end: parseISO("2026-09-20"),
    });
  });
});

describe("alignRangeStartToUnit", () => {
  const wednesday = parseISO("2026-09-16"); // mid-week, mid-month, mid-quarter

  it("leaves a Day-unit date untouched", () => {
    expect(alignRangeStartToUnit(wednesday, "day", 1)).toEqual(wednesday);
  });

  it("snaps to the week start for Week", () => {
    expect(alignRangeStartToUnit(wednesday, "week", 1)).toEqual(
      parseISO("2026-09-14"),
    );
  });

  it("snaps to the month start for Month", () => {
    expect(alignRangeStartToUnit(wednesday, "month", 1)).toEqual(
      parseISO("2026-09-01"),
    );
  });

  it("snaps to the quarter start for Quarter", () => {
    expect(alignRangeStartToUnit(wednesday, "quarter", 1)).toEqual(
      parseISO("2026-07-01"),
    );
  });
});

describe("buildGanttHeaderColumns", () => {
  const days = (start: string, end: string) =>
    eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });

  it("returns nothing for an empty day list", () => {
    expect(buildGanttHeaderColumns([], "week", 1)).toEqual([]);
  });

  it("gives Day one column per day, matching the day itself", () => {
    const columns = buildGanttHeaderColumns(
      days("2026-09-14", "2026-09-16"),
      "day",
      1,
    );
    expect(columns).toEqual([
      { label: "14", startIndex: 0, endIndex: 0 },
      { label: "15", startIndex: 1, endIndex: 1 },
      { label: "16", startIndex: 2, endIndex: 2 },
    ]);
  });

  it("groups Week columns by ISO week and labels each by its start date", () => {
    // Mon 2026-09-14 .. Sun 2026-09-27: exactly two Monday-starting weeks.
    const columns = buildGanttHeaderColumns(
      days("2026-09-14", "2026-09-27"),
      "week",
      1,
    );
    expect(columns).toEqual([
      { label: "Sep 14", startIndex: 0, endIndex: 6 },
      { label: "Sep 21", startIndex: 7, endIndex: 13 },
    ]);
  });

  it("gives a week column a partial span when the day list cuts it off", () => {
    // Starts on a Wednesday, so the first "week" column only covers the 3
    // remaining days of that week.
    const columns = buildGanttHeaderColumns(
      days("2026-09-16", "2026-09-21"),
      "week",
      1,
    );
    expect(columns).toEqual([
      { label: "Sep 14", startIndex: 0, endIndex: 4 },
      { label: "Sep 21", startIndex: 5, endIndex: 5 },
    ]);
  });

  it("groups Month columns by calendar month regardless of month length", () => {
    // August (31 days) then September (30 days) then a few days of October.
    const columns = buildGanttHeaderColumns(
      days("2026-08-01", "2026-10-03"),
      "month",
      1,
    );
    expect(columns).toEqual([
      { label: "Aug 2026", startIndex: 0, endIndex: 30 },
      { label: "Sep 2026", startIndex: 31, endIndex: 60 },
      { label: "Oct 2026", startIndex: 61, endIndex: 63 },
    ]);
  });

  it("groups Quarter columns by calendar quarter across a year boundary", () => {
    const columns = buildGanttHeaderColumns(
      days("2026-11-15", "2027-02-15"),
      "quarter",
      1,
    );
    expect(columns).toEqual([
      { label: "Q4 2026", startIndex: 0, endIndex: 46 },
      { label: "Q1 2027", startIndex: 47, endIndex: 92 },
    ]);
  });
});

describe("GANTT_UNIT_WINDOW_DAYS and unit-aware buildGanttRange", () => {
  it("keeps Day's window at the existing 91-day constant", () => {
    expect(GANTT_UNIT_WINDOW_DAYS.day).toBe(GANTT_WINDOW_DAYS);
  });

  it("widens the window as the unit gets coarser", () => {
    expect(GANTT_UNIT_WINDOW_DAYS.week).toBeGreaterThan(
      GANTT_UNIT_WINDOW_DAYS.day,
    );
    expect(GANTT_UNIT_WINDOW_DAYS.month).toBeGreaterThan(
      GANTT_UNIT_WINDOW_DAYS.week,
    );
    expect(GANTT_UNIT_WINDOW_DAYS.quarter).toBeGreaterThan(
      GANTT_UNIT_WINDOW_DAYS.month,
    );
  });

  it("reports the unit's window length on the built range", () => {
    // A task spanning the full supported date range so the window is never
    // clipped by padding — days.length is then exactly the unit's window.
    const range = buildGanttRange(
      [span("0001-01-01", "9999-12-31")],
      1,
      null,
      parseISO("2026-09-19"),
      "quarter",
    );
    expect(range?.windowDays).toBe(GANTT_UNIT_WINDOW_DAYS.quarter);
    expect(range?.days.length).toBe(GANTT_UNIT_WINDOW_DAYS.quarter);
  });

  it("aligns an explicitly requested start to the unit before clamping", () => {
    // A wide task span so the quarter window (~3 years) has room to land on
    // the requested quarter without the page bounds clamping it away.
    const range = buildGanttRange(
      [span("2020-01-01", "2032-12-31")],
      1,
      parseISO("2026-09-16"), // mid-quarter
      undefined,
      "quarter",
    );
    expect(range?.rangeStart).toEqual(parseISO("2026-07-01"));
  });

  it("defaults buildGanttTimeline to Day when no unit is passed", () => {
    const timeline = buildGanttTimeline(
      [span("0001-01-01", "9999-12-31")],
      1,
      3,
      null,
      parseISO("2026-09-19"),
    );
    expect(timeline?.days.length).toBe(GANTT_WINDOW_DAYS);
    expect(timeline?.windowDays).toBe(GANTT_WINDOW_DAYS);
  });
});
