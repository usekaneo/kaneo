import { describe, expect, it } from "vite-plus/test";
import { moveIntoHoveredColumn } from "./move-into-hovered-column";
import { columnIds, testBoard } from "./test-board";

describe("moveIntoHoveredColumn", () => {
  it("puts the card in the hovered card's slot", () => {
    const moved = moveIntoHoveredColumn(testBoard(), "a", "d");
    expect(columnIds(moved)).toEqual(["b", "c,a,d", ""]);
    expect(moved?.columns[1].tasks[1].status).toBe("doing");
  });

  it("appends the card when hovering the column itself", () => {
    expect(columnIds(moveIntoHoveredColumn(testBoard(), "a", "done"))).toEqual([
      "b",
      "c,d",
      "a",
    ]);
  });

  it("leaves same-column hovers to sortable", () => {
    expect(moveIntoHoveredColumn(testBoard(), "a", "b")).toBeNull();
  });
});
