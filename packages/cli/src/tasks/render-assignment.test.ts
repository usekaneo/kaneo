import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderAssignment } from "./render-assignment.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});
const url = "https://kaneo.test/task/1";

describe("renderAssignment", () => {
  it("names the new assignee", () => {
    expect(
      renderAssignment(ui, {
        label: "KAN-12",
        url,
        assignee: { name: "Ada Lovelace" },
      }),
    ).toEqual(["", "  ✓ KAN-12 assigned to Ada Lovelace", ""]);
  });

  it("says when the task was unassigned", () => {
    expect(
      renderAssignment(ui, { label: "KAN-12", url, assignee: null })[1],
    ).toBe("  ✓ KAN-12 unassigned");
  });
});
