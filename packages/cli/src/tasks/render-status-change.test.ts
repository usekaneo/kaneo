import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderStatusChange } from "./render-status-change.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const todo = { slug: "to-do", name: "To Do", isFinal: false };
const progress = { slug: "in-progress", name: "In Progress", isFinal: false };
const url = "https://kaneo.test/task/1";

describe("renderStatusChange", () => {
  it("shows the move between columns", () => {
    expect(
      renderStatusChange(ui, {
        label: "KAN-12",
        url,
        from: todo,
        to: progress,
      }),
    ).toEqual(["", "  ✓ KAN-12 · ● To Do → ● In Progress", ""]);
  });

  it("says when the task is already in the column", () => {
    expect(
      renderStatusChange(ui, {
        label: "KAN-12",
        url,
        from: progress,
        to: progress,
      })[1],
    ).toBe("  ✓ KAN-12 · already in ● In Progress");
  });

  it("links the ticket id when the terminal supports it", () => {
    const linked = makeUi({
      color: 0,
      unicode: true,
      hyperlinks: true,
      animate: false,
      columns: 80,
    });
    const [, line] = renderStatusChange(linked, {
      label: "KAN-12",
      url,
      from: todo,
      to: progress,
    });
    expect(line).toContain(`\u001b]8;;${url}\u001b\\KAN-12\u001b]8;;\u001b\\`);
  });
});
