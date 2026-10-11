import { parseISO } from "date-fns";
import { describe, expect, it } from "vite-plus/test";
import { filterTasks } from "./filter-tasks.js";
import type { ScheduledTask } from "./scheduled-task.js";

const tasks: ScheduledTask[] = [
  {
    id: "a",
    projectId: "project",
    number: 12,
    title: "Ship roadmap",
    description: null,
    status: "in-progress",
    priority: null,
    assigneeId: null,
    assigneeName: null,
    startDate: "2026-09-01",
    dueDate: "2026-09-02",
    scheduleStart: parseISO("2026-09-01"),
    scheduleEnd: parseISO("2026-09-02"),
  },
  {
    id: "b",
    projectId: "project",
    number: 3,
    title: "Write docs",
    description: null,
    status: "to-do",
    priority: null,
    assigneeId: null,
    assigneeName: null,
    startDate: "2026-09-03",
    dueDate: null,
    scheduleStart: parseISO("2026-09-03"),
    scheduleEnd: parseISO("2026-09-03"),
  },
];

const ids = (query: string) =>
  filterTasks(tasks, query, "KAN").map((task) => task.id);

describe("filterTasks", () => {
  it("returns every task for a blank query", () => {
    expect(ids("   ")).toEqual(["a", "b"]);
  });

  it("matches title, task key and status case-insensitively", () => {
    expect(ids("ROADMAP")).toEqual(["a"]);
    expect(ids("kan-3")).toEqual(["b"]);
    expect(ids("to-do")).toEqual(["b"]);
    expect(ids("nothing")).toEqual([]);
  });
});
