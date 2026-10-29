import { describe, expect, it } from "vite-plus/test";
import {
  toPluginSummary,
  toWorkspaceState,
} from "../../../apps/api/src/plugin-host/controllers/to-plugin-summary";
import type { LoadedPlugin } from "../../../apps/api/src/plugin-host/types";

const settings = {
  doneStatus: { type: "text", label: "Done status", default: "done" },
  token: { type: "secret", label: "Token" },
} as const;

const plugin: LoadedPlugin = {
  id: "progress",
  name: "Task progress",
  packageName: "kaneo-plugin-progress",
  version: "1.2.0+build.1",
  description: "Track progress",
  official: false,
  settings,
  options: { secret: "operator-only" },
  server: null,
  web: {
    root: "/kaneo/node_modules/kaneo-plugin-progress/dist/web",
    entry: "index.js",
    styles: "index.css",
    excluded: [],
  },
};

describe("toWorkspaceState", () => {
  it("never returns secret values", () => {
    expect(
      toWorkspaceState(plugin, {
        enabled: true,
        settings: { doneStatus: "shipped", token: "s3cret" },
      }),
    ).toEqual({
      enabled: true,
      settings: { doneStatus: "shipped" },
      configuredSecrets: ["token"],
    });
  });

  it("defaults to disabled with default settings", () => {
    expect(toWorkspaceState(plugin, undefined)).toEqual({
      enabled: false,
      settings: { doneStatus: "done" },
      configuredSecrets: [],
    });
  });

  it("defaults official plugins to enabled until a workspace turns them off", () => {
    const official = { ...plugin, official: true };
    expect(toWorkspaceState(official, undefined).enabled).toBe(true);
    expect(
      toWorkspaceState(official, { enabled: false, settings: {} }).enabled,
    ).toBe(false);
  });
});

describe("toPluginSummary", () => {
  it("returns asset paths relative to the API base without operator options", () => {
    const summary = toPluginSummary(plugin, null);
    expect(summary).toEqual({
      id: "progress",
      name: "Task progress",
      packageName: "kaneo-plugin-progress",
      version: "1.2.0+build.1",
      description: "Track progress",
      official: false,
      settings,
      web: {
        entry: "/plugins/progress/assets/index.js?v=1.2.0%2Bbuild.1",
        styles: "/plugins/progress/assets/index.css?v=1.2.0%2Bbuild.1",
      },
      workspace: null,
    });
    expect(JSON.stringify(summary)).not.toContain("operator-only");
  });

  it("returns null web paths for server-only plugins", () => {
    expect(toPluginSummary({ ...plugin, web: null }, null).web).toBeNull();
  });
});
