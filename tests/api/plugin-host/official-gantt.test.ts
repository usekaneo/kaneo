import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadConfiguredPlugins } from "../../../apps/api/src/plugin-host/config/load-configured-plugins";
import { clearLoadedPlugins } from "../../../apps/api/src/plugin-host/registry";

afterEach(() => {
  clearLoadedPlugins();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("@kaneo/gantt", () => {
  it("loads as a built-in plugin through the plugin loader", async () => {
    vi.stubEnv("DISABLE_PLUGINS", "");
    vi.stubEnv("KANEO_CONFIG", "");
    vi.spyOn(console, "log").mockImplementation(() => {});

    const [gantt, ...rest] = await loadConfiguredPlugins();
    expect(rest).toEqual([]);
    expect(gantt).toMatchObject({
      id: "gantt",
      packageName: "@kaneo/gantt",
      official: true,
      web: { entry: expect.any(String) },
    });
  });
});
