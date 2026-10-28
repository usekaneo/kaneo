import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderTaskChange } from "./render-task-change.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderTaskChange", () => {
  it("prints the created task on one line", () => {
    expect(
      renderTaskChange(ui, {
        verb: "Created",
        reference: "KAN-124",
        url: "https://kaneo.test/task/1",
        detail: "Fix login redirect",
      }),
    ).toEqual(["", "  ✓ Created KAN-124 · Fix login redirect", ""]);
  });

  it("lists the updated fields", () => {
    expect(
      renderTaskChange(ui, {
        verb: "Updated",
        reference: "KAN-12",
        url: "https://kaneo.test/task/1",
        detail: "title, priority",
      }),
    ).toEqual(["", "  ✓ Updated KAN-12 · title, priority", ""]);
  });

  it("links the ticket id when the terminal supports it", () => {
    const linked = makeUi({
      color: 0,
      unicode: true,
      hyperlinks: true,
      animate: false,
      columns: 80,
    });
    const [, line] = renderTaskChange(linked, {
      verb: "Created",
      reference: "KAN-1",
      url: "https://kaneo.test/task/1",
      detail: "Title",
    });
    expect(line).toContain(
      "\u001b]8;;https://kaneo.test/task/1\u001b\\KAN-1\u001b]8;;\u001b\\",
    );
  });
});
