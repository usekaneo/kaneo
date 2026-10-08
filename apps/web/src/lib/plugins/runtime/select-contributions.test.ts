import type { WebPluginDefinition } from "@kaneo/plugin-sdk/web";
import { describe, expect, it } from "vite-plus/test";
import type { PluginLoadState } from "@/store/plugin-runtime";
import type { InstalledPlugin } from "@/types/plugin";
import { normalizeWebDefinition } from "./normalize-web-definition";
import {
  findContribution,
  isActivePlugin,
  selectContributions,
  toRuntimePlugins,
} from "./select-contributions";

const View = () => null;

function installed(
  id: string,
  overrides: Partial<InstalledPlugin> = {},
): InstalledPlugin {
  return {
    id,
    name: id,
    packageName: id,
    version: "1.0.0",
    description: null,
    official: false,
    settings: {},
    web: { entry: `/plugins/${id}/assets/index.js?v=1.0.0`, styles: null },
    workspace: {
      enabled: true,
      settings: { mode: "fast" },
      configuredSecrets: [],
    },
    ...overrides,
  };
}

function definition(config: Partial<WebPluginDefinition>): WebPluginDefinition {
  return { kind: "kaneo-web", apiVersion: 1, ...config };
}

const progress = definition({
  projectViews: [{ id: "progress", title: "Progress", component: View }],
  taskPanels: [{ id: "panel", title: "Panel", component: View }],
  commands: [{ id: "recalc", title: "Recalculate", run: () => {} }],
});

const reports = definition({
  pages: [{ id: "reports", title: "Reports", component: View }],
  projectViews: [{ id: "chart", title: "Chart", component: View }],
});

describe("isActivePlugin", () => {
  it("requires a web entry and enablement in the workspace", () => {
    expect(isActivePlugin(installed("a"))).toBe(true);
    expect(isActivePlugin(installed("b", { web: null }))).toBe(false);
    expect(isActivePlugin(installed("c", { workspace: null }))).toBe(false);
    expect(
      isActivePlugin(
        installed("d", {
          workspace: { enabled: false, settings: {}, configuredSecrets: [] },
        }),
      ),
    ).toBe(false);
  });
});

describe("toRuntimePlugins", () => {
  it("scopes enabled plugins to the workspace and defaults to loading", () => {
    const runtime = toRuntimePlugins(
      [installed("progress"), installed("server-only", { web: null })],
      "ws-1",
      {},
    );

    expect(runtime).toHaveLength(1);
    expect(runtime[0]?.scope).toEqual({
      id: "progress",
      version: "1.0.0",
      workspaceId: "ws-1",
      settings: { mode: "fast" },
    });
    expect(runtime[0]?.state).toEqual({ status: "loading" });
  });
});

describe("selectContributions", () => {
  const states: Record<string, PluginLoadState> = {
    "progress@1.0.0": { status: "loaded", definition: progress },
    "reports@1.0.0": { status: "loaded", definition: reports },
    "broken@1.0.0": { status: "failed", error: new Error("boom") },
  };
  const plugins = toRuntimePlugins(
    [
      installed("progress"),
      installed("reports"),
      installed("broken"),
      installed("pending"),
      installed("disabled", {
        workspace: { enabled: false, settings: {}, configuredSecrets: [] },
      }),
    ],
    "ws-1",
    { ...states, "disabled@1.0.0": { status: "loaded", definition: reports } },
  );

  it("collects items only from loaded, enabled plugins in declaration order", () => {
    expect(
      selectContributions(plugins, "projectViews").map(
        ({ scope, item }) => `${scope.id}:${item.id}`,
      ),
    ).toEqual(["progress:progress", "reports:chart"]);
    expect(
      selectContributions(plugins, "pages").map(({ item }) => item.id),
    ).toEqual(["reports"]);
    expect(selectContributions(plugins, "commands")).toHaveLength(1);
  });

  it("looks up a single contribution with its load state", () => {
    expect(
      findContribution(plugins, "projectViews", "reports", "chart", false),
    ).toMatchObject({
      status: "ready",
      contribution: { item: { id: "chart" } },
    });
    expect(
      findContribution(plugins, "projectViews", "reports", "nope", false),
    ).toEqual({ status: "missing" });
    expect(
      findContribution(plugins, "projectViews", "broken", "x", false),
    ).toMatchObject({ status: "failed" });
    expect(
      findContribution(plugins, "projectViews", "pending", "x", false),
    ).toEqual({ status: "loading" });
    expect(
      findContribution(plugins, "projectViews", "disabled", "chart", false),
    ).toEqual({ status: "missing" });
    expect(
      findContribution(plugins, "projectViews", "unknown", "x", true),
    ).toEqual({ status: "loading" });
  });
});

describe("normalizeWebDefinition", () => {
  it("drops malformed and duplicate items so slots never crash the host", () => {
    const normalized = normalizeWebDefinition(
      definition({
        projectViews: [
          { id: "a", title: "A", component: View },
          { id: "a", title: "Duplicate", component: View },
          { id: "", title: "No id", component: View },
          { id: "b", title: "No component" },
        ] as never,
        commands: [
          { id: "run", title: "Run", run: () => {} },
          { id: "norun", title: "No run" },
        ] as never,
        taskPanels: "not a list" as never,
        settingsPanel: "nope" as never,
        translations: ["nope"] as never,
      }),
    );

    expect(normalized.projectViews?.map((view) => view.title)).toEqual(["A"]);
    expect(normalized.commands?.map((command) => command.id)).toEqual(["run"]);
    expect(normalized.taskPanels).toEqual([]);
    expect(normalized.pages).toEqual([]);
    expect(normalized.settingsPanel).toBeUndefined();
    expect(normalized.translations).toBeUndefined();
  });
});
