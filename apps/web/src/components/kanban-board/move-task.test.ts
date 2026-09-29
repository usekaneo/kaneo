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
});
