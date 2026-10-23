import { describe, expect, it } from "vite-plus/test";
import type {
  GlobalBoardTask,
  GlobalBoardTasksPage,
} from "@/fetchers/task/get-global-board-tasks";
import { insertIntoLane, removeFromLane } from "./move-between-lanes";

const task = (id: string) => ({ id }) as GlobalBoardTask;
const page = (
  ids: string[],
  pageNumber: number,
  total: number,
): GlobalBoardTasksPage => ({
  tasks: ids.map(task),
  pagination: { page: pageNumber, pageSize: 2, total, totalPages: 2 },
});
const lane = (...pages: GlobalBoardTasksPage[]) => ({
  pages,
  pageParams: pages.map((_, index) => index + 1),
});

describe("global board lane cache", () => {
  it("removes a task from whichever loaded page holds it", () => {
    const next = removeFromLane(
      lane(page(["a", "b"], 1, 3), page(["c"], 2, 3)),
      "c",
    );
    expect(next?.pages.map((p) => p.tasks.map((t) => t.id))).toEqual([
      ["a", "b"],
      [],
    ]);
    expect(next?.pages.map((p) => p.pagination.total)).toEqual([2, 2]);
  });

  it("leaves a lane alone when the task is not loaded there", () => {
    const original = lane(page(["a"], 1, 1));
    expect(removeFromLane(original, "z")).toBe(original);
  });

  it("inserts a task where it was dropped, across loaded pages", () => {
    const ids = (index: number) =>
      insertIntoLane(
        lane(page(["a", "b"], 1, 3), page(["c"], 2, 3)),
        task("x"),
        index,
      )?.pages.map((p) => p.tasks.map((t) => t.id));
    expect(ids(0)).toEqual([["x", "a", "b"], ["c"]]);
    expect(ids(2)).toEqual([["a", "b", "x"], ["c"]]);
    expect(ids(3)).toEqual([
      ["a", "b"],
      ["c", "x"],
    ]);
    expect(ids(9)).toEqual([
      ["a", "b"],
      ["c", "x"],
    ]);
  });

  it("counts the inserted task in every page total", () => {
    const next = insertIntoLane(lane(page(["a"], 1, 1)), task("b"), 1);
    expect(next?.pages[0]?.pagination.total).toBe(2);
  });

  it("skips lanes that have not loaded", () => {
    expect(insertIntoLane(undefined, task("b"), 0)).toBeUndefined();
  });
});
