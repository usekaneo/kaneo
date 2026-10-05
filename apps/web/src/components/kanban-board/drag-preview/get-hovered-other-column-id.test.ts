import { describe, expect, it } from "vite-plus/test";
import { getHoveredOtherColumnId } from "./get-hovered-other-column-id";
import { testBoard } from "./test-board";

describe("getHoveredOtherColumnId", () => {
  it("returns the hovered column when it differs from the card's column", () => {
    expect(getHoveredOtherColumnId(testBoard(), "a", "c")).toBe("doing");
    expect(getHoveredOtherColumnId(testBoard(), "a", "done")).toBe("done");
  });

  it("returns null within the card's column or for unknown ids", () => {
    expect(getHoveredOtherColumnId(testBoard(), "a", "b")).toBeNull();
    expect(getHoveredOtherColumnId(testBoard(), "a", "todo")).toBeNull();
    expect(getHoveredOtherColumnId(testBoard(), "a", "missing")).toBeNull();
  });
});
