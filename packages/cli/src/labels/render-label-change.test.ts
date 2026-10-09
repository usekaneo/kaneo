import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderLabelChange } from "./render-label-change.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderLabelChange", () => {
  it("confirms a created label with its chip", () => {
    expect(
      renderLabelChange(ui, { verb: "Created", name: "Bug", color: "red" }),
    ).toEqual(["", "  ✓ Created label ● Bug", ""]);
  });

  it("adds the detail after a separator", () => {
    expect(
      renderLabelChange(ui, {
        verb: "Updated",
        name: "Defect",
        color: "red",
        detail: "renamed from Bug, color crimson",
      })[1],
    ).toBe("  ✓ Updated label ● Defect · renamed from Bug, color crimson");
    expect(
      renderLabelChange(ui, {
        verb: "Deleted",
        name: "Bug",
        color: "red",
        detail: "removed from 3 tasks",
      })[1],
    ).toBe("  ✓ Deleted label ● Bug · removed from 3 tasks");
  });
});
