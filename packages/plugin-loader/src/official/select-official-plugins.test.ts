import { describe, expect, it } from "vite-plus/test";
import { OFFICIAL_PLUGINS } from "./official-plugins.js";
import { selectOfficialPlugins } from "./select-official-plugins.js";

const plugins = [{ id: "gantt" }, { id: "calendar" }];

describe("selectOfficialPlugins", () => {
  it("loads every official plugin unless the config turns it off", () => {
    expect(selectOfficialPlugins(plugins, {})).toEqual(plugins);
    expect(selectOfficialPlugins(plugins, { gantt: true })).toEqual(plugins);
    expect(selectOfficialPlugins(plugins, { gantt: false })).toEqual([
      { id: "calendar" },
    ]);
  });
});

describe("OFFICIAL_PLUGINS", () => {
  it("ships Gantt as a built-in plugin", () => {
    expect(
      OFFICIAL_PLUGINS.map(({ id, packageName }) => ({ id, packageName })),
    ).toEqual([{ id: "gantt", packageName: "@kaneo/gantt" }]);
  });
});
