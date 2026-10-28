import { describe, expect, it } from "vite-plus/test";
import type Task from "@/types/task";
import {
  compareWorkspaceTasks,
  insertWorkspaceTask,
} from "./compare-workspace-tasks";

function task(overrides: Partial<Task>): Task {
  return {
    id: "x",
    dueDate: null,
    priority: null,
    position: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Task;
}

describe("compareWorkspaceTasks", () => {
  it("orders by due date with undated tasks last", () => {
    const sorted = [
      task({ id: "undated" }),
      task({ id: "later", dueDate: "2026-10-20" }),
      task({ id: "soon", dueDate: "2026-10-16" }),
    ].sort(compareWorkspaceTasks);
    expect(sorted.map((item) => item.id)).toEqual(["soon", "later", "undated"]);
  });

  it("ranks priority, position, creation time and id after the due date", () => {
    const sorted = [
      task({ id: "b", priority: "low", position: 1 }),
      task({ id: "a", priority: "low", position: 1 }),
      task({ id: "c", priority: "urgent", position: 9 }),
      task({ id: "d", priority: "low", position: 0 }),
      task({ id: "e", priority: "low", position: 1, createdAt: "2025-01-01" }),
    ].sort(compareWorkspaceTasks);
    expect(sorted.map((item) => item.id)).toEqual(["c", "d", "e", "a", "b"]);
  });

  it("inserts at the server position", () => {
    const tasks = [
      task({ id: "a", dueDate: "2026-10-10" }),
      task({ id: "c", dueDate: "2026-10-30" }),
      task({ id: "d" }),
    ];
    const next = insertWorkspaceTask(
      tasks,
      task({ id: "b", dueDate: "2026-10-20" }),
    );
    expect(next.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(tasks).toHaveLength(3);
  });
});
