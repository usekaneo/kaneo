import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import type { ColumnJson } from "./column-json.js";
import { renderColumnList } from "./render-column-list.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const column = (
  position: number,
  name: string,
  slug: string,
  taskCount: number | null,
  isFinal = false,
): ColumnJson => ({
  id: `c${position}`,
  projectId: "p_kan",
  name,
  slug,
  position,
  icon: null,
  color: null,
  isFinal,
  taskCount,
});

const view = {
  projectName: "Kaneo Web",
  projectSlug: "kan",
  projectUrl: "https://kaneo.test/p",
  columns: [
    column(0, "To Do", "to-do", 6),
    column(1, "In Progress", "in-progress", 1),
    column(5, "Done", "done", 0, true),
  ],
};

describe("renderColumnList", () => {
  it("numbers columns in board order at 80 columns", () => {
    expect(renderColumnList(ui(80), view)).toEqual([
      "",
      "  Kaneo Web · KAN",
      "",
      "    1  ● To Do        to-do               6 tasks",
      "    2  ● In Progress  in-progress          1 task",
      "    3  ● Done         done         final  0 tasks",
      "",
    ]);
  });

  it("drops the slug and count before the name in narrow terminals", () => {
    const lines = renderColumnList(ui(24), view);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(24);
    expect(lines[3]).toBe("    1  ● To Do");
  });

  it("leaves the count blank when it was not loaded", () => {
    const [first] = renderColumnList(ui(80), {
      ...view,
      columns: [column(0, "To Do", "to-do", null)],
    }).slice(3);
    expect(first).toBe("    1  ● To Do  to-do");
  });
});
