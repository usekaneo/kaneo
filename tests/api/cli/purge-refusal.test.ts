import { describe, expect, it } from "vite-plus/test";
import { purgeRefusal } from "../../../apps/api/src/cli/commands/purge/purge-refusal";

const base = {
  officialIds: ["gantt"],
  officialToggles: {},
  configuredIds: ["kaneo-plugin-task-progress"],
  configName: "kaneo.config.ts",
};

describe("purgeRefusal", () => {
  it("refuses plugins that are still in the config", () => {
    expect(
      purgeRefusal({ ...base, pluginId: "kaneo-plugin-task-progress" }),
    ).toBe(
      'Plugin "kaneo-plugin-task-progress" is still installed. Remove it from kaneo.config.ts and restart Kaneo, then purge its data.',
    );
  });

  it("refuses built-in plugins unless the config turns them off", () => {
    expect(purgeRefusal({ ...base, pluginId: "gantt" })).toContain(
      "official: { gantt: false }",
    );
    expect(
      purgeRefusal({
        ...base,
        pluginId: "gantt",
        officialToggles: { gantt: true },
      }),
    ).toContain("built-in plugin");
    expect(
      purgeRefusal({
        ...base,
        pluginId: "gantt",
        officialToggles: { gantt: false },
      }),
    ).toBeNull();
  });

  it("refuses a config plugin that reuses a turned-off built-in id", () => {
    expect(
      purgeRefusal({
        ...base,
        pluginId: "gantt",
        officialToggles: { gantt: false },
        configuredIds: ["gantt"],
      }),
    ).toContain("is still installed");
  });

  it("allows plugins that are no longer installed", () => {
    expect(purgeRefusal({ ...base, pluginId: "kaneo-plugin-old" })).toBeNull();
  });
});
