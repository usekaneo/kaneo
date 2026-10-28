import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderOpenTask } from "./render-open-task.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});
const url = "https://kaneo.test/dashboard/workspace/w/project/p/task/t";

describe("renderOpenTask", () => {
  it("confirms the opened url", () => {
    expect(renderOpenTask(ui, { url, opened: true })).toEqual([
      "",
      `  → Opened ${url}`,
      "",
    ]);
  });

  it("prints the url to open by hand", () => {
    expect(renderOpenTask(ui, { url, opened: false })).toEqual([
      "",
      `  → Open ${url}`,
      "",
    ]);
  });

  it("falls back to ascii", () => {
    const ascii = makeUi({
      color: 0,
      unicode: false,
      hyperlinks: false,
      animate: false,
      columns: 80,
    });
    expect(renderOpenTask(ascii, { url, opened: true })[1]).toBe(
      `  -> Opened ${url}`,
    );
  });
});
