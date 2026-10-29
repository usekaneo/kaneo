import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderPluginPurge } from "./render-plugin-purge.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderPluginPurge", () => {
  it("prints how many rows were deleted from each table", () => {
    expect(
      renderPluginPurge(ui, {
        pluginId: "kaneo-plugin-old",
        storage: 3,
        workspaces: 1,
      }),
    ).toEqual([
      "",
      "  ✓ Purged kaneo-plugin-old",
      "    Deleted 3 rows from plugin_storage and 1 row from workspace_plugin.",
      "",
    ]);
  });

  it("says when there was nothing to delete", () => {
    expect(
      renderPluginPurge(ui, {
        pluginId: "kaneo-plugin-never",
        storage: 0,
        workspaces: 0,
      })[1],
    ).toBe("  ● kaneo-plugin-never had no stored data. Nothing was deleted.");
  });
});
