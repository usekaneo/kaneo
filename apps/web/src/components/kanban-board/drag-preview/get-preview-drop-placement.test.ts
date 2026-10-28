import { describe, expect, it } from "vite-plus/test";
import { getPreviewDropPlacement } from "./get-preview-drop-placement";
import { moveIntoHoveredColumn } from "./move-into-hovered-column";
import { testBoard } from "./test-board";

const preview = () => moveIntoHoveredColumn(testBoard(), "a", "c")!;

describe("getPreviewDropPlacement", () => {
  it("keeps the previewed slot when dropped on the card itself", () => {
    expect(getPreviewDropPlacement(preview(), "a", "a")).toEqual({
      overId: "c",
      insertAfterTarget: false,
    });
  });

  it("applies the final sortable hover within the column", () => {
    expect(getPreviewDropPlacement(preview(), "a", "d")).toEqual({
      overId: "d",
      insertAfterTarget: true,
    });
  });

  it("follows a final hover into another column", () => {
    expect(getPreviewDropPlacement(preview(), "a", "done")).toEqual({
      overId: "done",
      insertAfterTarget: undefined,
    });
  });
});
