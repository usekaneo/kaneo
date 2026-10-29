import { describe, expect, it } from "vite-plus/test";
import { toWorkspacePluginWrite } from "./workspace-plugin-write";

const official = { official: true };
const thirdParty = { official: false };

describe("toWorkspacePluginWrite", () => {
  it("updates only the enabled state when a request toggles the plugin", () => {
    expect(toWorkspacePluginWrite(thirdParty, { enabled: true })).toEqual({
      insert: { enabled: true, settings: {} },
      update: { enabled: true },
    });
  });

  it("updates only the settings when a request saves settings", () => {
    expect(
      toWorkspacePluginWrite(thirdParty, { settings: { mode: "fast" } }),
    ).toEqual({
      insert: { enabled: false, settings: { mode: "fast" } },
      update: { settings: { mode: "fast" } },
    });
  });

  it("inserts an official plugin as on when only settings are saved", () => {
    expect(
      toWorkspacePluginWrite(official, { settings: { label: "Roadmap" } })
        .insert,
    ).toEqual({ enabled: true, settings: { label: "Roadmap" } });
  });

  it("updates both fields when a request supplies both", () => {
    expect(
      toWorkspacePluginWrite(official, {
        enabled: false,
        settings: { label: "Roadmap" },
      }).update,
    ).toEqual({ enabled: false, settings: { label: "Roadmap" } });
  });

  it("updates nothing when a request supplies neither field", () => {
    expect(toWorkspacePluginWrite(official, {})).toEqual({
      insert: { enabled: true, settings: {} },
      update: {},
    });
  });
});
