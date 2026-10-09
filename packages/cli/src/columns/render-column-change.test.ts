import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderColumnChange } from "./render-column-change.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderColumnChange", () => {
  it("prints the column with its details", () => {
    expect(
      renderColumnChange(ui, {
        verb: "Created",
        column: { name: "QA", slug: "qa", isFinal: false },
        details: ["qa", ""],
      }),
    ).toEqual(["", "  ✓ Created ● QA · qa", ""]);
  });

  it("describes a delete that moved tasks", () => {
    expect(
      renderColumnChange(ui, {
        verb: "Deleted",
        column: { name: "QA", slug: "qa", isFinal: false },
        details: ["moved 3 tasks to To Do"],
      })[1],
    ).toBe("  ✓ Deleted ● QA · moved 3 tasks to To Do");
  });
});
