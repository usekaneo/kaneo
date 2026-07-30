import { describe, expect, it } from "vitest";
import { getBoardVisibleSubtaskCounts } from "../../../apps/api/src/task/utils/subtask-counts";

describe("getBoardVisibleSubtaskCounts", () => {
  it("counts only subtasks in board columns, excluding archived and planned", () => {
    const childrenMap = new Map([
      [
        "parent",
        ["child-todo", "child-done", "child-archived", "child-planned"],
      ],
    ]);
    const taskStatusMap = new Map([
      ["child-todo", "to-do"],
      ["child-done", "done"],
      ["child-archived", "archived"],
      ["child-planned", "planned"],
    ]);
    const boardColumnSlugs = new Set(["to-do", "in-progress", "done"]);
    const finalColumnSlugs = new Set(["done"]);

    expect(
      getBoardVisibleSubtaskCounts(
        "parent",
        childrenMap,
        taskStatusMap,
        boardColumnSlugs,
        finalColumnSlugs,
      ),
    ).toEqual({
      directSubtaskCount: 2,
      completedSubtaskCount: 1,
    });
  });

  it("returns zero counts when parent has no visible children", () => {
    const childrenMap = new Map([["parent", ["child-archived"]]]);
    const taskStatusMap = new Map([["child-archived", "archived"]]);
    const boardColumnSlugs = new Set(["to-do", "done"]);
    const finalColumnSlugs = new Set(["done"]);

    expect(
      getBoardVisibleSubtaskCounts(
        "parent",
        childrenMap,
        taskStatusMap,
        boardColumnSlugs,
        finalColumnSlugs,
      ),
    ).toEqual({
      directSubtaskCount: 0,
      completedSubtaskCount: 0,
    });
  });

  it("counts children whose status was loaded outside the paginated page", () => {
    const childrenMap = new Map([
      ["parent", ["child-on-page", "child-off-page"]],
    ]);
    const taskStatusMap = new Map([
      ["parent", "to-do"],
      ["child-on-page", "to-do"],
      // Status fetched in a follow-up query for off-page children
      ["child-off-page", "done"],
    ]);
    const boardColumnSlugs = new Set(["to-do", "done"]);
    const finalColumnSlugs = new Set(["done"]);

    expect(
      getBoardVisibleSubtaskCounts(
        "parent",
        childrenMap,
        taskStatusMap,
        boardColumnSlugs,
        finalColumnSlugs,
      ),
    ).toEqual({
      directSubtaskCount: 2,
      completedSubtaskCount: 1,
    });
  });
});
