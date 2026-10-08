import { join } from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { loadConfiguredPlugins } from "../../../apps/api/src/plugin-host/config/load-configured-plugins";
import { stopPluginJobs } from "../../../apps/api/src/plugin-host/context/plugin-jobs";
import { PluginLoadError } from "../../../apps/api/src/plugin-host/load-error";
import type { OfficialPlugin } from "../../../apps/api/src/plugin-host/official/official-plugins";
import { clearLoadedPlugins } from "../../../apps/api/src/plugin-host/registry";
import {
  createTempDir,
  descriptor,
  removeTempDirs,
  writeFiles,
  writePluginPackage,
} from "./fixtures";

const official = vi.hoisted(() => [] as OfficialPlugin[]);

vi.mock("../../../apps/api/src/plugin-host/official/official-plugins", () => ({
  OFFICIAL_PLUGINS: official,
}));

async function officialGantt() {
  const { url } = await writePluginPackage({
    name: "@kaneo/gantt",
    kaneo: { id: "gantt", name: "Gantt" },
  });
  const importFactory = vi.fn(async () => ({
    default: () => descriptor(url),
  }));
  official.splice(0, official.length, {
    id: "gantt",
    packageName: "@kaneo/gantt",
    importFactory,
  });
  return importFactory;
}

async function writeConfig(source: string) {
  const dir = await createTempDir();
  await writeFiles(dir, { "kaneo.config.mjs": source });
  vi.stubEnv("KANEO_CONFIG", join(dir, "kaneo.config.mjs"));
}

async function configWithPlugin(
  overrides: Parameters<typeof writePluginPackage>[0],
  extra = "",
) {
  const { url } = await writePluginPackage(overrides);
  await writeConfig(
    `export default { ${extra} plugins: [{ kind: "kaneo-plugin", apiVersion: 1, url: ${JSON.stringify(url)}, options: undefined, schema: null }] };`,
  );
}

beforeEach(() => {
  vi.stubEnv("DISABLE_PLUGINS", "");
  vi.stubEnv("KANEO_CONFIG", "");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
  stopPluginJobs();
  clearLoadedPlugins();
  await removeTempDirs();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  official.length = 0;
});

describe("loadConfiguredPlugins", () => {
  it("loads official plugins without a config file", async () => {
    await officialGantt();

    const loaded = await loadConfiguredPlugins();
    expect(
      loaded.map(({ id, packageName, official }) => ({
        id,
        packageName,
        official,
      })),
    ).toEqual([{ id: "gantt", packageName: "@kaneo/gantt", official: true }]);
  });

  it("loads nothing when plugins are disabled", async () => {
    const importFactory = await officialGantt();
    vi.stubEnv("DISABLE_PLUGINS", "true");

    expect(await loadConfiguredPlugins()).toEqual([]);
    expect(importFactory).not.toHaveBeenCalled();
  });

  it("loads official plugins before config plugins", async () => {
    await officialGantt();
    await configWithPlugin({});

    const loaded = await loadConfiguredPlugins();
    expect(loaded.map(({ id, official }) => [id, official])).toEqual([
      ["gantt", true],
      ["kaneo-plugin-progress", false],
    ]);
  });

  it("skips an official plugin the config turns off", async () => {
    const importFactory = await officialGantt();
    await configWithPlugin(
      { name: "@acme/gantt", kaneo: { id: "gantt" } },
      "official: { gantt: false },",
    );

    const loaded = await loadConfiguredPlugins();
    expect(importFactory).not.toHaveBeenCalled();
    expect(
      loaded.map(({ packageName, official }) => [packageName, official]),
    ).toEqual([["@acme/gantt", false]]);
  });

  it("fails at start when a config plugin takes an official plugin's id", async () => {
    await officialGantt();
    await configWithPlugin({ name: "@acme/gantt", kaneo: { id: "gantt" } });

    const error = await loadConfiguredPlugins().catch((reason) => reason);
    expect(error).toBeInstanceOf(PluginLoadError);
    expect(error).toMatchObject({ stage: "start", plugin: "@acme/gantt" });
    expect(error.hint).toContain("official: { gantt: false }");
  });

  it("fails at resolve when an official plugin cannot be imported", async () => {
    official.push({
      id: "gantt",
      packageName: "@kaneo/gantt",
      importFactory: async () => {
        throw new Error("Cannot find package '@kaneo/gantt'");
      },
    });

    const error = await loadConfiguredPlugins().catch((reason) => reason);
    expect(error).toBeInstanceOf(PluginLoadError);
    expect(error).toMatchObject({
      stage: "resolve",
      plugin: "@kaneo/gantt",
      message: "Cannot find package '@kaneo/gantt'",
    });
    expect(error.hint).toContain("official: { gantt: false }");
  });
});
