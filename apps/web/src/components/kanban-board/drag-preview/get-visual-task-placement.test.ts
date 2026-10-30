import { describe, expect, it } from "vite-plus/test";
import { getVisualTaskPlacement } from "./get-visual-task-placement";
import { testBoard } from "./test-board";

describe("getVisualTaskPlacement", () => {
  it("places the card before its next neighbor", () => {
    expect(getVisualTaskPlacement(testBoard(), "c")).toEqual({
      overId: "d",
      insertAfterTarget: false,
    });
  });

  it("places the last card after its previous neighbor", () => {
    expect(getVisualTaskPlacement(testBoard(), "d")).toEqual({
      overId: "c",
      insertAfterTarget: true,
    });
  });

  it("targets the column for a card alone in it", () => {
    const board = testBoard();
    board.columns[1].tasks = board.columns[1].tasks.slice(0, 1);
    expect(getVisualTaskPlacement(board, "c")).toEqual({
      overId: "doing",
      insertAfterTarget: undefined,
    });
  });

  it("returns null for an unknown card", () => {
    expect(getVisualTaskPlacement(testBoard(), "missing")).toBeNull();
  });
});
