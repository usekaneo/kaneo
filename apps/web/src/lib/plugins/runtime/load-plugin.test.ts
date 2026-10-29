import type { WebPluginDefinition } from "@kaneo/plugin-sdk/web";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { importPluginDefinition } = vi.hoisted(() => ({
  importPluginDefinition: vi.fn(),
}));

vi.mock("./import-plugin-definition", () => ({ importPluginDefinition }));

import { usePluginRuntimeStore } from "@/store/plugin-runtime";
import { loadPlugin } from "./load-plugin";

const plugin = {
  id: "progress",
  version: "1.2.0",
  web: { entry: "/api/plugins/progress/assets/index.js", styles: null },
};

const definition = {
  kind: "kaneo-web",
  apiVersion: 1,
} as unknown as WebPluginDefinition;

function state() {
  return usePluginRuntimeStore.getState().states["progress@1.2.0"];
}

describe("loadPlugin", () => {
  afterEach(() => {
    importPluginDefinition.mockReset();
    vi.restoreAllMocks();
  });

  it("imports again after a failed load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    importPluginDefinition
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(definition);

    await loadPlugin(plugin);
    expect(state()).toMatchObject({
      status: "failed",
      error: { message: "network down" },
    });

    await loadPlugin(plugin);
    expect(importPluginDefinition).toHaveBeenCalledTimes(2);
    expect(state()).toEqual({ status: "loaded", definition });

    await loadPlugin(plugin);
    expect(importPluginDefinition).toHaveBeenCalledTimes(2);
  });
});
