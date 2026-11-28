import type { PluginTask } from "@kaneo/plugin-sdk/web";
import { describe, expect, it } from "vite-plus/test";
import { isScheduled } from "./is-scheduled.js";
import { scheduleTasks } from "./schedule-tasks.js";

function task(overrides: Partial<PluginTask>): PluginTask {
  return {
    id: "task",
    projectId: "project",
    number: 1,
    title: "Task",
    description: null,
    status: "to-do",
    priority: null,
    assigneeId: null,
    assigneeName: null,
    startDate: null,
    dueDate: null,
    ...overrides,
  };
}

describe("isScheduled", () => {
  it("counts a task with a start date, a due date, or both", () => {
    expect(isScheduled(task({ startDate: "2026-09-01" }))).toBe(true);
    expect(isScheduled(task({ dueDate: "2026-09-01" }))).toBe(true);
    expect(
      isScheduled(task({ startDate: "2026-09-01", dueDate: "2026-09-04" })),
    ).toBe(true);
  });

  it("skips a task without a usable date", () => {
    expect(isScheduled(task({}))).toBe(false);
    expect(isScheduled(task({ dueDate: "not a date" }))).toBe(false);
  });

  it("agrees with the rows the timeline draws", () => {
    const tasks = [
      task({ id: "none" }),
      task({ id: "start", startDate: "2026-09-01" }),
      task({ id: "due", dueDate: "2026-09-02" }),
      task({ id: "broken", startDate: "not a date" }),
    ];
    expect(tasks.filter(isScheduled).map((item) => item.id)).toEqual(
      scheduleTasks(tasks, []).map((item) => item.id),
    );
  });
});
