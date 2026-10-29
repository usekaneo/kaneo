import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { publishEvent, getWorkspacePlugin, saveWorkspacePlugin } = vi.hoisted(
  () => ({
    publishEvent: vi.fn(),
    getWorkspacePlugin: vi.fn(),
    saveWorkspacePlugin: vi.fn(),
  }),
);

vi.mock("../../../apps/api/src/events", () => ({ publishEvent }));
vi.mock("../../../apps/api/src/plugin-host/data/workspace-plugins", () => ({
  getWorkspacePlugin,
  saveWorkspacePlugin,
}));
vi.mock("../../../apps/api/src/plugin-host/registry", () => ({
  getLoadedPlugin: (id: string) =>
    id === "progress"
      ? {
          id: "progress",
          name: "Progress",
          packageName: "kaneo-plugin-progress",
          version: "1.2.0",
          description: null,
          official: false,
          settings: { token: { type: "secret", label: "Token" } },
          options: undefined,
          server: null,
          web: null,
        }
      : undefined,
}));

import { updateWorkspacePlugin } from "../../../apps/api/src/plugin-host/controllers/update-workspace-plugin";

describe("updateWorkspacePlugin", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("tells other clients about the change without sending settings", async () => {
    getWorkspacePlugin.mockResolvedValue(undefined);
    saveWorkspacePlugin.mockImplementation(
      async (pluginId, _workspaceId, write) => ({ pluginId, ...write.insert }),
    );

    await updateWorkspacePlugin("progress", "workspace-1", {
      enabled: true,
      settings: { token: "do-not-broadcast" },
    });

    expect(publishEvent).toHaveBeenCalledWith("workspace_plugin.updated", {
      workspaceId: "workspace-1",
      pluginId: "progress",
      enabled: true,
    });
  });

  it("writes only the enabled state and reports the row as stored", async () => {
    getWorkspacePlugin.mockResolvedValue({
      pluginId: "progress",
      enabled: true,
      settings: {},
    });
    saveWorkspacePlugin.mockResolvedValue({
      pluginId: "progress",
      enabled: false,
      settings: { token: "saved-meanwhile" },
    });

    const result = await updateWorkspacePlugin("progress", "workspace-1", {
      enabled: false,
    });

    expect(saveWorkspacePlugin).toHaveBeenCalledWith(
      "progress",
      "workspace-1",
      {
        insert: { enabled: false, settings: {} },
        update: { enabled: false },
      },
    );
    expect(result).toEqual({
      ok: true,
      state: { enabled: false, settings: {}, configuredSecrets: ["token"] },
    });
  });

  it("writes only the settings when the request leaves enabled out", async () => {
    getWorkspacePlugin.mockResolvedValue({
      pluginId: "progress",
      enabled: false,
      settings: { token: "kept" },
    });
    saveWorkspacePlugin.mockImplementation(
      async (pluginId, _workspaceId, write) => ({ pluginId, ...write.insert }),
    );

    await updateWorkspacePlugin("progress", "workspace-1", { settings: {} });

    expect(saveWorkspacePlugin).toHaveBeenCalledWith(
      "progress",
      "workspace-1",
      {
        insert: { enabled: false, settings: { token: "kept" } },
        update: { settings: { token: "kept" } },
      },
    );
  });

  it("does not announce a change it refused to save", async () => {
    getWorkspacePlugin.mockResolvedValue(undefined);

    const result = await updateWorkspacePlugin("progress", "workspace-1", {
      settings: { token: 42 },
    });

    expect(result.ok).toBe(false);
    expect(saveWorkspacePlugin).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });
});
