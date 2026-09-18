import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatHours,
  parseDurationInput,
} from "./format-duration";
import {
  buildTimesheet,
  type TimesheetEntry,
  timesheetCsv,
  weekDays,
  weekStart,
} from "./timesheet";

function entry(overrides: Partial<TimesheetEntry>): TimesheetEntry {
  return {
    id: "e1",
    taskId: "t1",
    taskTitle: "Build nav",
    taskNumber: 4,
    projectId: "p1",
    projectName: "Website",
    projectSlug: "WEB",
    userName: "Alice",
    description: null,
    startTime: new Date(2026, 8, 14, 9, 0).toISOString(),
    endTime: new Date(2026, 8, 14, 10, 30).toISOString(),
    duration: 5400,
    ...overrides,
  };
}

describe("formatting", () => {
  it("formats a live clock and rounded totals", () => {
    expect(formatClock(249)).toBe("0:04:09");
    expect(formatClock(45000)).toBe("12:30:00");
    expect(formatHours(45 * 60)).toBe("45m");
    expect(formatHours(7200)).toBe("2h");
    expect(formatHours(7500)).toBe("2h 05m");
  });
});

describe("weeks", () => {
  it("starts weeks on Monday", () => {
    const start = weekStart(new Date(2026, 8, 18)); // a Friday
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(14);
    expect(weekDays(start)).toHaveLength(7);
  });
});

describe("buildTimesheet", () => {
  const days = weekDays(weekStart(new Date(2026, 8, 14)));
  const now = new Date(2026, 8, 16, 12, 0);

  it("adds up time per task and day, grouped by project", () => {
    const sheet = buildTimesheet(
      [
        entry({ id: "a" }),
        entry({
          id: "b",
          startTime: new Date(2026, 8, 15, 9, 0).toISOString(),
          endTime: new Date(2026, 8, 15, 10, 0).toISOString(),
          duration: 3600,
        }),
        entry({
          id: "c",
          taskId: "t2",
          taskTitle: "Login",
          projectId: "p2",
          projectName: "App",
          projectSlug: "APP",
          taskNumber: 1,
          duration: 1800,
          endTime: new Date(2026, 8, 14, 9, 30).toISOString(),
        }),
      ],
      days,
      now,
    );

    expect(sheet.projects.map((p) => p.projectName)).toEqual([
      "App",
      "Website",
    ]);
    const website = sheet.projects[1];
    expect(website.rows[0]).toMatchObject({ taskKey: "WEB-4", total: 9000 });
    expect(website.rows[0].perDay.slice(0, 2)).toEqual([5400, 3600]);
    expect(sheet.perDay[0]).toBe(5400 + 1800);
    expect(sheet.total).toBe(5400 + 3600 + 1800);
  });

  it("counts a running entry up to now", () => {
    const sheet = buildTimesheet(
      [
        entry({
          startTime: new Date(2026, 8, 16, 11, 0).toISOString(),
          endTime: null,
          duration: null,
        }),
      ],
      days,
      now,
    );
    expect(sheet.total).toBe(3600);
  });
});

describe("timesheetCsv", () => {
  it("writes one escaped row per entry with hours as decimals", () => {
    const csv = timesheetCsv(
      [entry({ description: 'Fixed "menu", again' })],
      ["Date", "Start", "End", "Hours", "Person", "Project", "Task", "Note"],
      new Date(),
    );
    const [header, row] = csv.replace("﻿", "").trim().split("\r\n");
    expect(header).toBe("Date,Start,End,Hours,Person,Project,Task,Note");
    expect(row).toBe(
      '2026-09-14,09:00,10:30,1.50,Alice,Website,Build nav,"Fixed ""menu"", again"',
    );
  });
});

describe("parseDurationInput", () => {
  it("reads the ways people write an estimate", () => {
    expect(parseDurationInput("3h")).toBe(180);
    expect(parseDurationInput("90m")).toBe(90);
    expect(parseDurationInput("1h 30m")).toBe(90);
    expect(parseDurationInput("1.5")).toBe(90);
    expect(parseDurationInput("1,5h")).toBe(90);
    expect(parseDurationInput("2:30")).toBe(150);
  });

  it("rejects what it cannot read", () => {
    expect(parseDurationInput("")).toBeNull();
    expect(parseDurationInput("soon")).toBeNull();
    expect(parseDurationInput("0")).toBeNull();
    expect(parseDurationInput("h")).toBeNull();
  });
});
