import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { renderWorkspaceChange } from "./render-workspace-change.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const acme = {
  id: "ws_acme",
  name: "Acme Studio",
  slug: "acme-studio",
  description: null,
};

describe("renderWorkspaceChange", () => {
  it("confirms a new workspace and suggests switching to it", () => {
    expect(
      renderWorkspaceChange(ui, {
        verb: "Created",
        workspace: acme,
        next: "Run kaneo workspace use acme-studio to make it your default.",
      }),
    ).toEqual([
      "",
      "  ✓ Created Acme Studio · acme-studio",
      "",
      "  Run kaneo workspace use acme-studio to make it your default.",
      "",
    ]);
  });

  it("lists what an edit changed", () => {
    expect(
      renderWorkspaceChange(ui, {
        verb: "Updated",
        workspace: acme,
        changed: ["name", "description"],
      }),
    ).toEqual([
      "",
      "  ✓ Updated Acme Studio · acme-studio",
      "    Changed name, description",
      "",
    ]);
  });

  it("drops the slug when leaving", () => {
    expect(
      renderWorkspaceChange(ui, { verb: "Left", workspace: acme }),
    ).toEqual(["", "  ✓ Left Acme Studio", ""]);
  });

  it("truncates a long name to 80 columns", () => {
    const lines = renderWorkspaceChange(ui, {
      verb: "Deleted",
      workspace: { ...acme, name: "A".repeat(120) },
    });
    expect(lines[1]?.endsWith("… · acme-studio")).toBe(true);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });
});
