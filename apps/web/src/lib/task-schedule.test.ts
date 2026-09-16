import { describe, expect, it } from "vitest";
import {
  parseTaskDate,
  toScheduledTask,
  toScheduledTasks,
} from "./task-schedule";

function task(id: string, startDate: string | null, dueDate: string | null) {
  return { id, startDate, dueDate };
}

describe("parseTaskDate", () => {
  it("returns null for empty and unparseable values", () => {
    expect(parseTaskDate(null)).toBeNull();
    expect(parseTaskDate(undefined)).toBeNull();
    expect(parseTaskDate("")).toBeNull();
    expect(parseTaskDate("not-a-date")).toBeNull();
  });

  it("parses an ISO string", () => {
    expect(parseTaskDate("2026-08-13T00:00:00.000Z")?.toISOString()).toBe(
      "2026-08-13T00:00:00.000Z",
    );
  });
});

describe("toScheduledTask", () => {
  it("falls back to the due date when only a due date exists", () => {
    const scheduled = toScheduledTask(
      task("a", null, "2026-08-13T00:00:00.000Z"),
    );

    expect(scheduled?.scheduleStart.toISOString()).toBe(
      "2026-08-13T00:00:00.000Z",
    );
    expect(scheduled?.scheduleEnd.toISOString()).toBe(
      "2026-08-13T00:00:00.000Z",
    );
  });

  it("falls back to the start date when only a start date exists", () => {
    const scheduled = toScheduledTask(
      task("a", "2026-08-10T00:00:00.000Z", null),
    );

    expect(scheduled?.scheduleStart.toISOString()).toBe(
      "2026-08-10T00:00:00.000Z",
    );
    expect(scheduled?.scheduleEnd.toISOString()).toBe(
      "2026-08-10T00:00:00.000Z",
    );
  });

  it("drops a task with neither date", () => {
    expect(toScheduledTask(task("a", null, null))).toBeNull();
  });

  it("drops a task whose only date is unparseable", () => {
    expect(toScheduledTask(task("a", "nonsense", null))).toBeNull();
  });

  it("swaps a reversed range instead of dropping it", () => {
    const scheduled = toScheduledTask(
      task("a", "2026-08-20T00:00:00.000Z", "2026-08-10T00:00:00.000Z"),
    );

    expect(scheduled?.scheduleStart.toISOString()).toBe(
      "2026-08-10T00:00:00.000Z",
    );
    expect(scheduled?.scheduleEnd.toISOString()).toBe(
      "2026-08-20T00:00:00.000Z",
    );
  });

  it("preserves the other task fields", () => {
    const scheduled = toScheduledTask({
      id: "a",
      startDate: "2026-08-10T00:00:00.000Z",
      dueDate: null,
      title: "Ship it",
    });

    expect(scheduled?.id).toBe("a");
    expect(scheduled?.title).toBe("Ship it");
  });
});

describe("toScheduledTasks", () => {
  const source = {
    columns: [
      {
        tasks: [
          task("late", "2026-08-20T00:00:00.000Z", "2026-08-22T00:00:00.000Z"),
          task("undated", null, null),
        ],
      },
      {
        tasks: [
          task("early", "2026-08-01T00:00:00.000Z", "2026-08-03T00:00:00.000Z"),
        ],
      },
    ],
    plannedTasks: [
      task("planned", "2026-08-10T00:00:00.000Z", "2026-08-11T00:00:00.000Z"),
    ],
  };

  it("flattens columns and planned tasks, sorted by start date", () => {
    expect(toScheduledTasks(source).map((entry) => entry.id)).toEqual([
      "early",
      "planned",
      "late",
    ]);
  });

  it("returns an empty list for missing data", () => {
    expect(toScheduledTasks(undefined)).toEqual([]);
    expect(toScheduledTasks(null)).toEqual([]);
    expect(toScheduledTasks({ columns: [], plannedTasks: [] })).toEqual([]);
  });
});
