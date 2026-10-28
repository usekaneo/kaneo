import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { renderTaskDuplicated } from "./render-task-duplicated.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderTaskDuplicated", () => {
  it("shows the source and the copy", () => {
    expect(
      renderTaskDuplicated(ui, {
        sourceLabel: "KAN-3",
        label: "KAN-19",
        url: "https://kaneo.test/t",
        title: "Fix login redirect",
      }),
    ).toEqual(["", "  ✓ Duplicated KAN-3 → KAN-19 · Fix login redirect", ""]);
  });

  it("fits a long title into 80 columns", () => {
    const [, line] = renderTaskDuplicated(ui, {
      sourceLabel: "KAN-3",
      label: "MOB-120",
      url: "https://kaneo.test/t",
      title: "A very long task title ".repeat(6),
    });
    expect(stringWidth(line ?? "")).toBeLessThanOrEqual(80);
  });
});
