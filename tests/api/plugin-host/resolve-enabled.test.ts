import { describe, expect, it } from "vite-plus/test";
import {
  enabledInAnyWorkspace,
  enabledPluginIds,
  enabledWorkspaceIds,
  resolvePluginEnabled,
} from "../../../apps/api/src/plugin-host/enablement/resolve-enabled";

const official = { id: "gantt", official: true };
const thirdParty = { id: "progress", official: false };

describe("resolvePluginEnabled", () => {
  it("uses the stored choice when a workspace made one", () => {
    expect(resolvePluginEnabled(official, false)).toBe(false);
    expect(resolvePluginEnabled(official, true)).toBe(true);
    expect(resolvePluginEnabled(thirdParty, true)).toBe(true);
    expect(resolvePluginEnabled(thirdParty, false)).toBe(false);
  });

  it("turns official plugins on and third-party plugins off by default", () => {
    expect(resolvePluginEnabled(official, undefined)).toBe(true);
    expect(resolvePluginEnabled(official, null)).toBe(true);
    expect(resolvePluginEnabled(thirdParty, undefined)).toBe(false);
    expect(resolvePluginEnabled(thirdParty, null)).toBe(false);
  });
});

describe("enabledPluginIds", () => {
  it("resolves every loaded plugin against the workspace rows", () => {
    const other = { id: "reports", official: false };
    expect(
      enabledPluginIds(
        [official, thirdParty, other],
        [
          { pluginId: "progress", enabled: true },
          { pluginId: "reports", enabled: false },
          { pluginId: "uninstalled", enabled: true },
        ],
      ),
    ).toEqual(new Set(["gantt", "progress"]));

    expect(
      enabledPluginIds(
        [official, thirdParty],
        [{ pluginId: "gantt", enabled: false }],
      ),
    ).toEqual(new Set());
  });
});

describe("enabledInAnyWorkspace", () => {
  it("includes each plugin once when it is on in any of the workspaces", () => {
    const other = { id: "reports", official: false };
    expect(
      enabledInAnyWorkspace(
        [official, thirdParty, other],
        [
          [{ pluginId: "progress", enabled: true }],
          [
            { pluginId: "progress", enabled: true },
            { pluginId: "gantt", enabled: false },
          ],
        ],
      ),
    ).toEqual(new Set(["gantt", "progress"]));

    expect(
      enabledInAnyWorkspace(
        [official, thirdParty],
        [
          [{ pluginId: "gantt", enabled: false }],
          [{ pluginId: "gantt", enabled: false }],
        ],
      ),
    ).toEqual(new Set());
  });
});

describe("enabledWorkspaceIds", () => {
  const workspaces = [
    { workspaceId: "w1", enabled: null },
    { workspaceId: "w2", enabled: true },
    { workspaceId: "w3", enabled: false },
  ];

  it("includes workspaces without a row for official plugins", () => {
    expect(enabledWorkspaceIds(official, workspaces)).toEqual(["w1", "w2"]);
  });

  it("includes only workspaces that turned a third-party plugin on", () => {
    expect(enabledWorkspaceIds(thirdParty, workspaces)).toEqual(["w2"]);
  });
});
