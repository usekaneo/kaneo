import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderTaskDeleted } from "./render-task-deleted.js";

describe("renderTaskDeleted", () => {
  it("prints a one-line result", () => {
    const ui = makeUi({
      color: 0,
      unicode: true,
      hyperlinks: false,
      animate: false,
      columns: 80,
    });
    expect(
      renderTaskDeleted(ui, { label: "KAN-12", title: "Fix login" }),
    ).toEqual(["", "  ✓ Deleted KAN-12 · Fix login", ""]);
  });
});
