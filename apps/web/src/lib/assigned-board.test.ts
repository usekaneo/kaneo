import { describe, expect, it } from "vitest";
import type { AssignedTaskProject, AssignedTasksData } from "@/types/my-tasks";
import type Task from "@/types/task";
import { buildAssignedBoard, MY_TASKS_BOARD_ID } from "./assigned-board";

function column(
  slug: string,
  position: number,
  overrides: Partial<AssignedTaskProject["columns"][number]> = {},
) {
  return {
    id: `${slug}-${position}`,
    slug,
    name: slug,
    icon: null,
    isFinal: false,
    position,
    ...overrides,
  };
}

function project(
  id: string,
  position: number,
  columns: AssignedTaskProject["columns"],
  workspaceId = "ws-1",
): AssignedTaskProject {
  return {
    id,
    slug: id.toUpperCase(),
    name: id,
    icon: null,
    position,
    workspaceId,
    workspaceName: workspaceId,
    columns,
  };
}

function task(id: string, projectId: string, status: string): Task {
  return {
    id,
    title: id,
    number: 1,
    description: null,
    status,
    priority: "low",
    startDate: null,
    dueDate: null,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    userId: "me",
    assigneeId: "me",
    assigneeName: "Me",
    projectId,
    labels: [],
    externalLinks: [],
  };
}

describe("buildAssignedBoard", () => {
  const alpha = project("alpha", 0, [
    column("to-do", 0, { name: "To do" }),
    column("in-progress", 1, { name: "In progress", icon: "Loader" }),
    column("done", 2, { name: "Done", isFinal: true }),
  ]);
  const beta = project(
    "beta",
    1,
    [
      column("to-do", 0, { name: "Backlog-ish" }),
      column("qa", 1, { name: "QA" }),
      column("done", 2, { name: "Shipped", isFinal: false }),
    ],
    "ws-2",
  );

  const data: Pick<AssignedTasksData, "tasks" | "projects"> = {
    projects: [alpha, beta],
    tasks: [
      task("t1", "alpha", "to-do"),
      task("t2", "beta", "to-do"),
      task("t3", "beta", "qa"),
      task("t4", "alpha", "done"),
    ],
  };

  it("merges columns by slug, ordered by their lowest position then slug", () => {
    const { board } = buildAssignedBoard(data);

    expect(board.id).toBe(MY_TASKS_BOARD_ID);
    expect(board.columns.map((c) => c.slug)).toEqual([
      "to-do",
      "in-progress",
      "qa",
      "done",
    ]);
    // Every merged column is addressable by slug, like the board endpoint.
    expect(board.columns.every((c) => c.id === c.slug)).toBe(true);
  });

  it("names a merged column after the first project that declares it", () => {
    const { board } = buildAssignedBoard(data);
    const todo = board.columns.find((c) => c.slug === "to-do");
    const inProgress = board.columns.find((c) => c.slug === "in-progress");

    expect(todo?.name).toBe("To do");
    expect(inProgress?.icon).toBe("Loader");
  });

  it("marks a merged column final when any project does", () => {
    const { board } = buildAssignedBoard(data);
    expect(board.columns.find((c) => c.slug === "done")?.isFinal).toBe(true);
  });

  it("buckets tasks by status across projects and indexes their project", () => {
    const { board, projectIdByTaskId, projectById } = buildAssignedBoard(data);

    expect(
      board.columns.find((c) => c.slug === "to-do")?.tasks.map((t) => t.id),
    ).toEqual(["t1", "t2"]);
    expect(
      board.columns.find((c) => c.slug === "qa")?.tasks.map((t) => t.id),
    ).toEqual(["t3"]);
    expect(projectIdByTaskId.get("t3")).toBe("beta");
    expect(projectById.get("beta")?.workspaceId).toBe("ws-2");
  });

  it("drops tasks whose project or column is unknown", () => {
    const { board, projectIdByTaskId } = buildAssignedBoard({
      projects: [alpha],
      tasks: [
        task("orphan", "gamma", "to-do"),
        task("stray", "alpha", "not-a-column"),
        task("kept", "alpha", "to-do"),
      ],
    });

    const all = board.columns.flatMap((c) => c.tasks.map((t) => t.id));
    expect(all).toEqual(["kept"]);
    expect(projectIdByTaskId.has("orphan")).toBe(false);
    expect(projectIdByTaskId.has("stray")).toBe(false);
  });

  it("returns an empty board when nothing is assigned", () => {
    const { board } = buildAssignedBoard({ projects: [], tasks: [] });
    expect(board.columns).toEqual([]);
    expect(board.plannedTasks).toEqual([]);
    expect(board.archivedTasks).toEqual([]);
  });
});
