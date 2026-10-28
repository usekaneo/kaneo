import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { patchWorkspaceBoardTask } from "./patch-workspace-board-task";

function board() {
  return {
    id: "workspace-board:w",
    columns: [
      {
        id: "todo",
        slug: "todo",
        isFinal: false,
        tasks: [
          {
            id: "a",
            projectId: "p1",
            projectSlug: "ONE",
            projectName: "One",
            status: "todo",
            title: "old",
            userId: "u",
            assigneeId: "u",
            dueDate: "2026-10-20",
            priority: "low",
            position: 0,
            createdAt: "2026-01-01",
          },
          {
            id: "b",
            projectId: "p2",
            projectSlug: "TWO",
            status: "todo",
            title: "b",
            dueDate: null,
            priority: "high",
            position: 0,
            createdAt: "2026-01-02",
          },
        ],
      },
      { id: "doing", slug: "doing", isFinal: false, tasks: [] },
      { id: "done", slug: "done", isFinal: true, tasks: [] },
    ],
    archivedTasks: [],
    plannedTasks: [],
    projects: [{ id: "p1" }, { id: "p2" }],
  } as unknown as ProjectWithTasks & { projects: Array<{ id: string }> };
}

describe("patchWorkspaceBoardTask", () => {
  it("moves the task into the column of its new status and keeps board identity", () => {
    const next = patchWorkspaceBoardTask(board(), "a", {
      status: "doing",
      title: "new",
    });
    expect(next?.columns[0].tasks.map((task) => task.id)).toEqual(["b"]);
    expect(next?.columns[1].tasks[0]).toMatchObject({
      id: "a",
      title: "new",
      status: "doing",
      projectSlug: "ONE",
      projectName: "One",
      assigneeId: "u",
    });
  });

  it("clears the assignee when userId is part of the update", () => {
    const next = patchWorkspaceBoardTask(board(), "a", { userId: null });
    expect(
      next?.columns[0].tasks.find((task) => task.id === "a"),
    ).toMatchObject({
      userId: null,
      assigneeId: null,
    });
  });

  it("inserts at the server position within the column", () => {
    const next = patchWorkspaceBoardTask(board(), "a", {
      dueDate: "2026-10-10",
    });
    expect(next?.columns[0].tasks.map((task) => task.id)).toEqual(["a", "b"]);
    const later = patchWorkspaceBoardTask(board(), "a", { dueDate: null });
    expect(later?.columns[0].tasks.map((task) => task.id)).toEqual(["b", "a"]);
  });

  it("drops tasks that become completed unless completed tasks are shown", () => {
    const hidden = patchWorkspaceBoardTask(board(), "a", { status: "done" });
    expect(hidden?.columns.flatMap((column) => column.tasks)).toHaveLength(1);
    const shown = patchWorkspaceBoardTask(
      board(),
      "a",
      { status: "done" },
      { includeCompleted: true },
    );
    expect(shown?.columns[2].tasks.map((task) => task.id)).toEqual(["a"]);
  });

  it("decides completion by the task's own project", () => {
    const source = {
      ...board(),
      projects: [
        { id: "p1", finalColumnSlugs: ["done", "doing"] },
        { id: "p2", finalColumnSlugs: [] },
      ],
    };
    const p1 = patchWorkspaceBoardTask(source, "a", { status: "doing" });
    expect(p1?.columns[1].tasks).toEqual([]);
    const p2 = patchWorkspaceBoardTask(source, "b", { status: "done" });
    expect(p2?.columns[2].tasks.map((task) => task.id)).toEqual(["b"]);
  });

  it("drops archived, planned and foreign-project tasks", () => {
    expect(
      patchWorkspaceBoardTask(board(), "a", { status: "archived" })?.columns[0]
        .tasks,
    ).toHaveLength(1);
    expect(
      patchWorkspaceBoardTask(board(), "a", { status: "planned" })?.columns[0]
        .tasks,
    ).toHaveLength(1);
    expect(
      patchWorkspaceBoardTask(board(), "a", { projectId: "p9" })?.columns[0]
        .tasks,
    ).toHaveLength(1);
  });

  it("asks for a reload when the status has no merged column", () => {
    expect(patchWorkspaceBoardTask(board(), "a", { status: "qa" })).toBeNull();
  });

  it("removes a task without an update and ignores unknown tasks", () => {
    const source = board();
    expect(patchWorkspaceBoardTask(source, "a")?.columns[0].tasks).toHaveLength(
      1,
    );
    expect(patchWorkspaceBoardTask(source, "zzz")).toBe(source);
    expect(patchWorkspaceBoardTask(source, "zzz", { title: "x" })).toBe(source);
  });

  it("gives a joining task its project identity", () => {
    const source = {
      ...board(),
      workspaceId: "w",
      projects: [{ id: "p1", name: "One", slug: "ONE", icon: "rocket" }],
    };
    const next = patchWorkspaceBoardTask(source, "c", {
      id: "c",
      projectId: "p1",
      status: "doing",
      title: "fresh",
      createdAt: "2026-02-01",
    });
    expect(next?.columns[1].tasks[0]).toMatchObject({
      projectSlug: "ONE",
      projectName: "One",
      projectIcon: "rocket",
      workspaceId: "w",
    });
  });

  it("adds a full task that was not on the board yet", () => {
    const next = patchWorkspaceBoardTask(board(), "c", {
      id: "c",
      projectId: "p1",
      status: "doing",
      title: "fresh",
      createdAt: "2026-02-01",
    });
    expect(next?.columns[1].tasks.map((task) => task.id)).toEqual(["c"]);
  });
});

describe("patchWorkspaceBoardTask bookkeeping", () => {
  const withTotal = () => ({ ...board(), total: 5 });

  it("keeps the server total in step with tasks that join or leave", () => {
    expect(
      patchWorkspaceBoardTask(withTotal(), "a", { status: "done" })?.total,
    ).toBe(4);
    expect(patchWorkspaceBoardTask(withTotal(), "a")?.total).toBe(4);
    expect(
      patchWorkspaceBoardTask(withTotal(), "c", {
        id: "c",
        projectId: "p1",
        status: "doing",
        title: "fresh",
        createdAt: "2026-02-01",
      })?.total,
    ).toBe(6);
    expect(
      patchWorkspaceBoardTask(withTotal(), "a", { title: "x" })?.total,
    ).toBe(5);
    expect(patchWorkspaceBoardTask(withTotal(), "zzz")?.total).toBe(5);
  });

  it("defers descriptions too large for a board", () => {
    const next = patchWorkspaceBoardTask(board(), "a", {
      description: "x".repeat(64 * 1024 + 1),
    });
    expect(
      next?.columns[0].tasks.find((task) => task.id === "a"),
    ).toMatchObject({
      description: null,
      descriptionDeferred: true,
    });
  });
});
