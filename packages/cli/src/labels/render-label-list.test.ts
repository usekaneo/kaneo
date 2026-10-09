import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { type LabelListRow, renderLabelList } from "./render-label-list.js";

const ui = (columns = 80) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const rows: ReadonlyArray<LabelListRow> = [
  { id: "l1", name: "Bug", color: "red", tasks: 3, deleting: false },
  { id: "l2", name: "Docs", color: "#00ff00", tasks: 1, deleting: false },
  { id: "l3", name: "Old", color: "gray", tasks: 0, deleting: true },
];

describe("renderLabelList", () => {
  it("shows a chip, the name and how many tasks use it", () => {
    expect(renderLabelList(ui(), rows)).toEqual([
      "",
      "  ●  Bug              3 tasks",
      "  ●  Docs              1 task",
      "  ●  Old · deleting  no tasks",
      "",
    ]);
  });

  it("drops the count before truncating names on narrow terminals", () => {
    const lines = renderLabelList(ui(20), rows);
    expect(lines[1]).toBe("  ●  Bug");
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(20);
  });

  it("colors the chip at truecolor", () => {
    const colored = makeUi({
      color: 3,
      unicode: true,
      hyperlinks: false,
      animate: false,
      columns: 80,
    });
    expect(renderLabelList(colored, rows)[1]).toContain(
      "\u001b[38;2;231;0;11m●\u001b[39m",
    );
  });

  it("points to label create when there are none", () => {
    expect(renderLabelList(ui(), [])).toEqual([
      "",
      "  No labels in this workspace yet. Create one with kaneo label create <name>.",
      "",
    ]);
  });
});
