import { applyBoardReorder, rollbackBoardReorder } from "./apply-reorder";
import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { moveBoardTask } from "./move-task";

function board() {
  return {
    id: "project",
    columns: [
      {
        id: "todo",
        slug: "todo",
        tasks: [
          { id: "a", status: "todo", position: 0, title: "keep a" },
          { id: "hidden", status: "todo", position: 1, title: "keep hidden" },
          { id: "b", status: "todo", position: 2, title: "keep b" },
        ],
      },
      {
        id: "doing",
        slug: "doing",
        tasks: [{ id: "c", status: "doing", position: 0 }],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
}

describe("board moves", () => {
  it("preserves hidden tasks while producing only focused ordering changes", () => {
    const original = board();
    const moved = moveBoardTask(original, "a", "b")!;
    expect(moved.project.columns[0].tasks.map((task) => task.id)).toEqual([
      "hidden",
      "b",
      "a",
    ]);
    expect(moved.project.columns[0].tasks.map((task) => task.title)).toEqual([
      "keep hidden",
      "keep b",
      "keep a",
    ]);
    expect(moved.tasks).toEqual([
      { id: "hidden", position: 0 },
      { id: "b", position: 1 },
      { id: "a", position: 2 },
    ]);
    expect(original.columns[0].tasks[0].id).toBe("a");
  });

  it("moves across columns without copying unrelated task fields", () => {
    const moved = moveBoardTask(board(), "a", "doing")!;
    expect(moved.tasks).toContainEqual({
      id: "a",
      position: 1,
      status: "doing",
    });
    expect(
      moved.tasks.every((task) =>
        Object.keys(task).every((key) =>
          ["id", "position", "status"].includes(key),
        ),
      ),
    ).toBe(true);
    expect(moved.project.columns[1].tasks.map((task) => task.id)).toEqual([
      "c",
      "a",
    ]);
  });

  it("updates only the moved task on a board sorted by task number", () => {
    expect(moveBoardTask(board(), "a", "doing", true)?.tasks).toEqual([
      { id: "a", position: 1, status: "doing" },
    ]);
  });

  it("can insert before a cross-column target for a visual drag preview", () => {
    const moved = moveBoardTask(board(), "a", "c", false, false)!;

    expect(moved.project.columns[1].tasks.map((task) => task.id)).toEqual([
      "a",
      "c",
    ]);
  });
});

it("patches a remote reorder without removing hidden cards or replacing concurrent fields", () => {
  const current = board();
  current.columns[0].tasks[0].title = "concurrent title";
  const updated = applyBoardReorder(current, [
    { id: "a", position: 1, status: "doing" },
    { id: "b", position: 0 },
  ]);
  expect(updated.columns[0].tasks.map((task) => task.id)).toEqual([
    "b",
    "hidden",
  ]);
  expect(updated.columns[1].tasks.map((task) => task.id)).toEqual(["c", "a"]);
  expect(updated.columns[1].tasks[1].title).toBe("concurrent title");
  expect(current.columns[0].tasks).toHaveLength(3);
});

it("rolls back a failed drag while preserving a newer title edit", () => {
  const previous = board();
  const moved = moveBoardTask(previous, "a", "doing")!;
  const current = structuredClone(moved.project);
  const card = current.columns
    .flatMap((column) => column.tasks)
    .find((task) => task.id === "a")!;
  card.title = "new title";
  const restored = rollbackBoardReorder(current, previous, moved.tasks)!;
  expect(
    restored.columns[0].tasks.find((task) => task.id === "a"),
  ).toMatchObject({
    title: "new title",
    status: "todo",
    position: previous.columns[0].tasks.find((task) => task.id === "a")!
      .position,
  });
});
it("preserves a newer remote order instead of rolling it back", () => {
  const previous = board();
  const moved = moveBoardTask(previous, "a", "doing")!;
  const current = structuredClone(moved.project);
  current.columns
    .flatMap((column) => column.tasks)
    .find((task) => task.id === "a")!.position = 99;
  expect(rollbackBoardReorder(current, previous, moved.tasks)).toBeNull();
});

it("patches and sorts planned and archived task reorders", () => {
  const project = board();
  project.plannedTasks = [
    { id: "p1", status: "planned", position: 0 },
    { id: "p2", status: "planned", position: 1 },
  ] as typeof project.plannedTasks;
  project.archivedTasks = [
    { id: "a1", status: "archived", position: 0 },
    { id: "a2", status: "archived", position: 1 },
  ] as typeof project.archivedTasks;
  const updated = applyBoardReorder(project, [
    { id: "p1", position: 1 },
    { id: "p2", position: 0 },
    { id: "a1", position: 1 },
    { id: "a2", position: 0 },
  ]);
  expect(updated.plannedTasks.map((task) => task.id)).toEqual(["p2", "p1"]);
  expect(updated.archivedTasks.map((task) => task.id)).toEqual(["a2", "a1"]);
});

it("moves cards between ordinary, planned and archived buckets while preserving metadata", () => {
  const project = board();
  project.plannedTasks = [
    { id: "p", status: "planned", position: 0, title: "planned title" },
  ] as typeof project.plannedTasks;
  project.archivedTasks = [
    { id: "z", status: "archived", position: 0 },
  ] as typeof project.archivedTasks;
  const updated = applyBoardReorder(project, [
    { id: "a", position: 1, status: "planned" },
    { id: "p", position: 2, status: "archived" },
    { id: "z", position: 3, status: "doing" },
  ]);
  expect(updated.plannedTasks).toEqual([
    expect.objectContaining({
      id: "a",
      status: "planned",
      columnId: null,
      title: "keep a",
    }),
  ]);
  expect(updated.archivedTasks).toEqual([
    expect.objectContaining({
      id: "p",
      status: "archived",
      columnId: null,
      title: "planned title",
    }),
  ]);
  expect(updated.columns[1].tasks).toContainEqual(
    expect.objectContaining({ id: "z", status: "doing", columnId: "doing" }),
  );
  expect(updated.columns[0].tasks.some((task) => task.id === "a")).toBe(false);
});
