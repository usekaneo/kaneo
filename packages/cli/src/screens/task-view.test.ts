import { describe, expect, it } from "vite-plus/test";
import type { ColorLevel } from "../render/capabilities.js";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { renderTaskView } from "../task-view/render-task-view.js";
import { toTaskViewJson } from "../task-view/task-view-json.js";
import {
  projectSlugsFixture,
  resolvedTask,
  sectionsFixture,
  viewNow,
  webUrl,
} from "../task-view/test-task-view.js";

const task = toTaskViewJson({
  resolved: resolvedTask,
  sections: sectionsFixture,
  projectSlugs: projectSlugsFixture,
  webUrl,
  commentLimit: 3,
  now: viewNow,
});

const variants: ReadonlyArray<{ columns: number; color: ColorLevel }> = [
  { columns: 80, color: 0 },
  { columns: 120, color: 0 },
  { columns: 80, color: 3 },
  { columns: 120, color: 3 },
];

describe("task view screen", () => {
  for (const { columns, color } of variants) {
    it(`fully loaded task at ${columns} columns, ${color === 0 ? "no color" : "truecolor"}`, () => {
      const ui = makeUi({
        color,
        unicode: true,
        hyperlinks: color > 0,
        animate: false,
        columns,
      });
      const lines = renderTaskView(ui, {
        task,
        statusFinal: false,
        now: viewNow,
        commentTotal: 5,
      });
      for (const line of lines) {
        expect(stringWidth(line)).toBeLessThanOrEqual(columns);
      }
      expect(`\n${lines.join("\n")}\n`).toMatchSnapshot();
    });
  }
});
