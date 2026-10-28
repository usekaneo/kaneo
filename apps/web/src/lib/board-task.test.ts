import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { boardTaskProject, findBoardTask } from "./board-task";

const board = {
  workspaceId: "workspace-1",
  columns: [
    { tasks: [{ id: "task-1", projectId: "project-1" }] },
    {
      tasks: [
        { id: "task-2", projectId: "project-2", workspaceId: "workspace-2" },
      ],
    },
  ],
} as unknown as ProjectWithTasks;

describe("findBoardTask", () => {
  it("finds a task in any column", () => {
    expect(findBoardTask(board, "task-2")?.projectId).toBe("project-2");
  });

  it("returns nothing for an unknown task or a missing board", () => {
    expect(findBoardTask(board, "task-3")).toBeUndefined();
    expect(findBoardTask(undefined, "task-1")).toBeUndefined();
  });
});

describe("boardTaskProject", () => {
  it("uses the task's own project and falls back to the board's workspace", () => {
    expect(boardTaskProject(board, "task-1")).toEqual({
      id: "project-1",
      workspaceId: "workspace-1",
    });
  });

  it("prefers the workspace the task carries", () => {
    expect(boardTaskProject(board, "task-2")).toEqual({
      id: "project-2",
      workspaceId: "workspace-2",
    });
  });

  it("returns null when the task is not on the board", () => {
    expect(boardTaskProject(board, "task-3")).toBeNull();
    expect(boardTaskProject(undefined, "task-1")).toBeNull();
  });
});
