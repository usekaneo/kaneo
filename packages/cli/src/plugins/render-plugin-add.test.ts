import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import type { PluginAddResult } from "./plugin-add-result.js";
import { renderPluginAdd } from "./render-plugin-add.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const result: PluginAddResult = {
  packageName: "kaneo-plugin-time-report",
  version: "1.1.0",
  range: ">=2.29.0 <3",
  kaneoVersion: "2.29.3",
  kaneoVersionSource: "flag",
  catalog: "listed",
  projectDir: "/srv/kaneo",
  installed: ["kaneo-plugin-time-report@1.1.0", "@kaneo/config@2.29.3"],
  createdPackageJson: true,
  config: {
    status: "created",
    file: "/srv/kaneo/kaneo.config.ts",
    importName: "timeReport",
  },
};

describe("renderPluginAdd", () => {
  it("shows the release, the install and the config change", () => {
    const lines = renderPluginAdd(ui, result);
    expect(lines.slice(0, 4)).toEqual([
      "",
      "  ✓ Added kaneo-plugin-time-report 1.1.0 · supports Kaneo >=2.29.0 <3",
      "    Installed kaneo-plugin-time-report@1.1.0 and @kaneo/config@2.29.3 in /srv/kaneo.",
      "    Created kaneo.config.ts with timeReport() in plugins.",
    ]);
    expect(lines.at(-2)).toContain("run kaneo plugin check");
  });

  it("prints the lines to add when the config could not be edited", () => {
    const lines = renderPluginAdd(ui, {
      ...result,
      config: {
        status: "manual",
        file: "/srv/kaneo/kaneo.config.ts",
        importName: "timeReport",
        reason: "it uses CommonJS",
      },
    });
    expect(lines).toContain(
      '      import timeReport from "kaneo-plugin-time-report";',
    );
    expect(lines.join("\n")).toContain(
      "Could not update kaneo.config.ts safely: it uses CommonJS.",
    );
  });
});
