import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { renderTaskMove } from "./render-task-move.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const move = {
  fromLabel: "KAN-12",
  toLabel: "MOB-4",
  title: "Fix login redirect",
  url: "https://kaneo.test/task/1",
};

describe("renderTaskMove", () => {
  it("shows the old and new ticket ids with the title", () => {
    expect(renderTaskMove(ui(80), move)).toEqual([
      "",
      "  ✓ Moved KAN-12 → MOB-4 · Fix login redirect",
      "",
    ]);
  });

  it("truncates a long title to the terminal width", () => {
    const [, line = ""] = renderTaskMove(ui(40), {
      ...move,
      title: "A".repeat(60),
    });
    expect(stringWidth(line)).toBe(40);
    expect(line.endsWith("…")).toBe(true);
  });
});
