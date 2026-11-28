import type { PluginTask } from "@kaneo/plugin-sdk/web";
import { parseISO } from "date-fns";
import { describe, expect, it } from "vite-plus/test";
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

const columns = [
  { id: "to-do", name: "To Do", slug: "to-do", isFinal: false },
  { id: "done", name: "Done", slug: "done", isFinal: true },
];

describe("scheduleTasks", () => {
  it("drops unscheduled tasks and fills a missing start or due date", () => {
    const scheduled = scheduleTasks(
      [
        task({ id: "none" }),
        task({ id: "due", dueDate: "2026-09-04" }),
        task({ id: "start", startDate: "2026-09-02" }),
      ],
      columns,
    );
    expect(scheduled.map((item) => item.id)).toEqual(["start", "due"]);
    expect(scheduled[1]?.scheduleStart).toEqual(parseISO("2026-09-04"));
    expect(scheduled[1]?.scheduleEnd).toEqual(parseISO("2026-09-04"));
  });

  it("swaps reversed dates", () => {
    const [scheduled] = scheduleTasks(
      [task({ startDate: "2026-09-10", dueDate: "2026-09-01" })],
      columns,
    );
    expect(scheduled?.scheduleStart).toEqual(parseISO("2026-09-01"));
    expect(scheduled?.scheduleEnd).toEqual(parseISO("2026-09-10"));
  });

  it("sorts by start, then by column order with planned tasks last", () => {
    const scheduled = scheduleTasks(
      [
        task({ id: "planned", status: "planned", startDate: "2026-09-01" }),
        task({ id: "done", status: "done", startDate: "2026-09-01" }),
        task({ id: "later", status: "to-do", startDate: "2026-09-02" }),
        task({ id: "todo", status: "to-do", startDate: "2026-09-01" }),
      ],
      columns,
    );
    expect(scheduled.map((item) => item.id)).toEqual([
      "todo",
      "done",
      "planned",
      "later",
    ]);
  });
});
