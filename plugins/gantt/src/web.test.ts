import { WeekStartControl } from "@kaneo/plugin-sdk/ui";
import type { PluginTask } from "@kaneo/plugin-sdk/web";
import { describe, expect, it } from "vite-plus/test";
import definition from "./web.js";

const [timeline] = definition.projectViews ?? [];

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

describe("Gantt timeline layout", () => {
  it("covers the board and the backlog's planned tasks, with the week start in Display", () => {
    expect(timeline).toMatchObject({
      id: "timeline",
      shortcut: "g",
      scope: "schedule",
    });
    expect(timeline?.display).toBe(WeekStartControl);
  });

  it("counts only the tasks the timeline can place", () => {
    const countsTask = timeline?.countsTask;
    expect(countsTask?.(task({ dueDate: "2026-09-01T00:00:00.000Z" }))).toBe(
      true,
    );
    expect(countsTask?.(task({ startDate: "2026-09-01T00:00:00.000Z" }))).toBe(
      true,
    );
    expect(countsTask?.(task({}))).toBe(false);
  });
});
