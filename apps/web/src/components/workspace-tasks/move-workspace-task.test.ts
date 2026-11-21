import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { moveWorkspaceTask } from "./move-workspace-task";

const board = {
  columns: [
    {
      id: "to-do",
      slug: "to-do",
      tasks: [{ id: "a", status: "to-do", dueDate: "2026-10-10" }],
    },
    {
      id: "done",
      slug: "done",
      tasks: [
        { id: "b", status: "done", dueDate: "2026-10-01" },
        { id: "c", status: "done", dueDate: null },
      ],
    },
  ],
} as unknown as ProjectWithTasks;

describe("moveWorkspaceTask", () => {
  it("moves the task into the column at its server position", () => {
    const next = moveWorkspaceTask(board, "a", "done");
    expect(next.columns[0].tasks).toEqual([]);
    expect(next.columns[1].tasks.map((task) => task.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(next.columns[1].tasks[1].status).toBe("done");
    expect(board.columns[0].tasks).toHaveLength(1);
  });

  it("returns the same board for unknown targets or no-op drops", () => {
    expect(moveWorkspaceTask(board, "a", "nope")).toBe(board);
    expect(moveWorkspaceTask(board, "zzz", "done")).toBe(board);
    expect(moveWorkspaceTask(board, "a", "to-do")).toBe(board);
  });
});
