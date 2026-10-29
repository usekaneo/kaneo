import { describe, expect, it } from "vite-plus/test";
import { makeTheme } from "./output/theme.js";
import { renderSummary } from "./render-summary.js";

const plugin = {
  id: "task-progress",
  name: "Task progress",
  packageName: "kaneo-plugin-task-progress",
  version: "0.1.0",
  engines: ">=2.29.0 <3",
};

describe("renderSummary", () => {
  it("lists the built files with aligned sizes", () => {
    expect(
      renderSummary(makeTheme(false), {
        plugin,
        files: [
          { path: "dist/index.js", bytes: 123 },
          { path: "dist/web/index.js", bytes: 7629 },
        ],
        warnings: [],
      }),
    ).toEqual([
      "Built Task progress (task-progress) 0.1.0 for Kaneo >=2.29.0 <3",
      "  dist/index.js      0.12 kB",
      "  dist/web/index.js  7.45 kB",
    ]);
  });

  it("leaves out the Kaneo range when the plugin has none", () => {
    expect(
      renderSummary(makeTheme(false), {
        plugin: { ...plugin, engines: null },
        files: [],
        warnings: [],
      }),
    ).toEqual(["Built Task progress (task-progress) 0.1.0"]);
  });
});
