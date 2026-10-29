import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import type { PluginCheckReport } from "./check-report.js";
import { renderPluginCheck } from "./render-plugin-check.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const report: PluginCheckReport = {
  projectDir: "/srv/kaneo",
  configPath: "/srv/kaneo/kaneo.config.ts",
  declared: 2,
  kaneoVersion: "2.29.3",
  kaneoVersionSource: "installation",
  skippedBuiltIn: [],
  warnings: [],
  plugins: [
    {
      status: "ok",
      id: "gantt",
      packageName: "@kaneo/gantt",
      version: "0.1.0",
      official: true,
    },
    {
      status: "ok",
      id: "kaneo-plugin-task-progress",
      packageName: "kaneo-plugin-task-progress",
      version: "0.1.0",
      official: false,
    },
  ],
  failed: 0,
};

describe("renderPluginCheck", () => {
  it("prints a line per plugin that passed", () => {
    expect(renderPluginCheck(ui, report)).toEqual([
      "",
      "  Checking /srv/kaneo/kaneo.config.ts against Kaneo 2.29.3",
      "",
      "  ✓ gantt 0.1.0 · built in",
      "  ✓ kaneo-plugin-task-progress 0.1.0",
      "",
      "  ✓ All 2 plugins passed the startup checks.",
      "",
    ]);
  });

  it("prints the boot error of each failing plugin", () => {
    const lines = renderPluginCheck(ui, {
      ...report,
      kaneoVersionSource: "flag",
      plugins: [
        {
          status: "failed",
          packageName: "kaneo-plugin-old",
          official: false,
          stage: "options",
          message: "The options are invalid:\nautoComplete: Expected boolean",
          hint: "Fix the options passed to the plugin in /srv/kaneo/kaneo.config.ts.",
        },
      ],
      failed: 1,
    });
    expect(lines).toEqual([
      "",
      "  Checking /srv/kaneo/kaneo.config.ts against Kaneo 2.29.3 (from --kaneo-version)",
      "",
      '  ✗ Plugin "kaneo-plugin-old" failed at options:',
      "    The options are invalid:",
      "    autoComplete: Expected boolean",
      "    → Fix the options passed to the plugin in /srv/kaneo/kaneo.config.ts.",
      "",
      "  ✗ 1 of 1 plugins failed. Kaneo would stop at startup with this config.",
      "",
    ]);
  });

  it("explains a missing config, skipped built-ins and warnings", () => {
    const lines = renderPluginCheck(ui, {
      ...report,
      configPath: null,
      declared: 0,
      kaneoVersionSource: "config-package",
      skippedBuiltIn: ["gantt"],
      warnings: ["Plugin x does not declare engines.kaneo."],
      plugins: [],
    });
    expect(lines).toEqual([
      "",
      "  No kaneo.config.ts, kaneo.config.js, or kaneo.config.mjs in /srv/kaneo, so only the built-in plugins are checked against Kaneo 2.29.3 (from @kaneo/config in the project).",
      "  Built-in plugins (gantt) are only checked inside a Kaneo installation.",
      "  ▲ Plugin x does not declare engines.kaneo.",
      "",
      "  There are no plugins to check.",
      "",
    ]);
  });

  it("says when the config declares no plugins", () => {
    expect(
      renderPluginCheck(ui, { ...report, declared: 0, plugins: [] }),
    ).toContain("  /srv/kaneo/kaneo.config.ts declares no plugins.");
  });
});
