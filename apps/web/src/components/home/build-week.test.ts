import { describe, expect, it } from "vite-plus/test";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { buildWeek } from "./build-week";
import { getDayPart } from "./day-part";

const now = new Date(2026, 9, 2, 15, 0);

function task(id: string, dueDate: Date | null): AssignedTask {
  return {
    id,
    projectId: "project-1",
    number: 1,
    title: id,
    status: "to-do",
    statusName: "To Do",
    statusIcon: null,
    priority: "medium",
    dueDate: dueDate ? dueDate.toISOString() : null,
    projectName: "Web",
    projectSlug: "WEB",
    projectIcon: null,
    labels: [],
  };
}

describe("buildWeek", () => {
  it("spans three days either side of today", () => {
    const week = buildWeek([], now);

    expect(week).toHaveLength(7);
    expect(week.map((day) => day.date.getDate())).toEqual([
      29, 30, 1, 2, 3, 4, 5,
    ]);
    expect(week.map((day) => day.isToday)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(week.filter((day) => day.isPast)).toHaveLength(3);
  });

  it("places tasks on the day they are due and skips the rest", () => {
    const week = buildWeek(
      [
        task("late", new Date(2026, 8, 30, 9)),
        task("today", new Date(2026, 9, 2, 23, 30)),
        task("far", new Date(2026, 10, 1)),
        task("undated", null),
      ],
      now,
    );

    expect(week[1].tasks.map((item) => item.id)).toEqual(["late"]);
    expect(week[3].tasks.map((item) => item.id)).toEqual(["today"]);
    expect(week.flatMap((day) => day.tasks)).toHaveLength(2);
  });
});

describe("getDayPart", () => {
  it("maps the hour to a greeting", () => {
    expect(getDayPart(new Date(2026, 9, 2, 8))).toBe("morning");
    expect(getDayPart(new Date(2026, 9, 2, 13))).toBe("afternoon");
    expect(getDayPart(new Date(2026, 9, 2, 21))).toBe("evening");
    expect(getDayPart(new Date(2026, 9, 2, 2))).toBe("evening");
  });
});
