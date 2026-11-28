import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import type { PluginJson } from "./plugin-json.js";
import { renderPluginList } from "./render-plugin-list.js";

const ui = (columns = 80) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const plugins: ReadonlyArray<PluginJson> = [
  {
    id: "gantt",
    name: "Gantt",
    packageName: "@kaneo/gantt",
    version: "0.1.0",
    description: null,
    official: true,
    enabled: true,
  },
  {
    id: "kaneo-plugin-task-progress",
    name: "Task progress",
    packageName: "kaneo-plugin-task-progress",
    version: "0.2.0",
    description: null,
    official: false,
    enabled: false,
  },
];

describe("renderPluginList", () => {
  it("shows the name, id, version, whether it is built in and enabled", () => {
    expect(renderPluginList(ui(), plugins)).toEqual([
      "",
      "  Name           ID                          Version  Built in  Enabled",
      "  Gantt          gantt                       0.1.0    yes       ✓ on",
      "  Task progress  kaneo-plugin-task-progress  0.2.0    no        off",
      "",
    ]);
  });

  it("drops the optional columns on narrow terminals", () => {
    for (const line of renderPluginList(ui(40), plugins)) {
      expect(stringWidth(line)).toBeLessThanOrEqual(40);
    }
  });

  it("points to the docs when nothing is installed", () => {
    expect(renderPluginList(ui(), [])[1]).toContain("No plugins are installed");
  });
});
