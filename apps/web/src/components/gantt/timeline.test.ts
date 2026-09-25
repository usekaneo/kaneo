import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  buildGanttTimeline,
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
