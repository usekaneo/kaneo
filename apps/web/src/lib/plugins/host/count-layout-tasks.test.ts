import type { PluginTask } from "@kaneo/plugin-sdk/web";
import { describe, expect, it, vi } from "vite-plus/test";
import { countLayoutTasks } from "./count-layout-tasks";

const task = (id: string, dueDate: string | null): PluginTask => ({
  id,
  projectId: "p1",
  number: 1,
  title: id,
  description: null,
  status: "to-do",
  priority: null,
  assigneeId: null,
  assigneeName: null,
  startDate: null,
  dueDate,
});

const tasks = [task("a", "2026-10-01T00:00:00.000Z"), task("b", null)];

describe("countLayoutTasks", () => {
  it("counts every task unless the layout narrows the count", () => {
    expect(countLayoutTasks(tasks, undefined)).toBe(2);
    expect(countLayoutTasks(tasks, (item) => item.dueDate !== null)).toBe(1);
  });

  it("falls back to every task when the plugin's rule throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      countLayoutTasks(tasks, () => {
        throw new Error("broken");
      }),
    ).toBe(2);
    error.mockRestore();
  });
});
