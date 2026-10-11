import { describe, expect, it } from "vite-plus/test";
import type { InstalledPlugin } from "@/types/plugin";
import { pluginsForWorkspace } from "./plugins-for-workspace";
import { type RuntimePlugin, toRuntimePlugins } from "./select-contributions";

function installed(id: string): InstalledPlugin {
  return {
    id,
    name: id,
    packageName: id,
    version: "1.0.0",
    description: null,
    official: false,
    settings: {},
    web: { entry: `/plugins/${id}/assets/index.js?v=1.0.0`, styles: null },
    workspace: { enabled: true, settings: {}, configuredSecrets: [] },
  };
}

const gantt = toRuntimePlugins([installed("gantt")], "ws-b", {});

function ids(plugins: readonly RuntimePlugin[]): string[] {
  return plugins.map((runtime) => runtime.plugin.id);
}

describe("pluginsForWorkspace", () => {
  it("keeps the workspace's plugins for a record it owns", () => {
    expect(ids(pluginsForWorkspace(gantt, "ws-b", "ws-b"))).toEqual(["gantt"]);
  });

  it("drops every plugin for a record owned by another workspace", () => {
    expect(pluginsForWorkspace(gantt, "ws-b", "ws-a")).toEqual([]);
  });

  it("drops every plugin while the owner is unknown", () => {
    expect(pluginsForWorkspace(gantt, "ws-b", undefined)).toEqual([]);
  });

  it("drops plugins scoped to a different workspace than the route", () => {
    expect(pluginsForWorkspace(gantt, "ws-a", "ws-a")).toEqual([]);
  });
});
