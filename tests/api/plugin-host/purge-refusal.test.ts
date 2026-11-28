import { describe, expect, it } from "vite-plus/test";
import {
  disabledRefusal,
  installedRefusal,
} from "../../../apps/api/src/plugin-host/controllers/purge-refusal";

describe("installedRefusal", () => {
  it("asks to remove a configured plugin from the config first", () => {
    expect(
      installedRefusal("kaneo-plugin-task-progress", false, "kaneo.config.ts"),
    ).toBe(
      'Plugin "kaneo-plugin-task-progress" is still installed. Remove it from kaneo.config.ts and restart Kaneo, then purge its data.',
    );
  });

  it("asks to turn a built-in plugin off first", () => {
    expect(installedRefusal("gantt", true, "kaneo.config.mjs")).toBe(
      '"gantt" is a built-in plugin and it is still on. Turn it off with official: { gantt: false } in kaneo.config.mjs and restart Kaneo, then purge its data.',
    );
  });
});

describe("disabledRefusal", () => {
  it("explains that installed plugins are unknown without the plugin system", () => {
    expect(disabledRefusal("gantt")).toContain("DISABLE_PLUGINS=true");
  });
});
