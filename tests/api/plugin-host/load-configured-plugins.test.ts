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
import { clearLoadedPlugins } from "../../../apps/api/src/plugin-host/registry";
import {
  createTempDir,
  removeTempDirs,
  writeFiles,
  writePluginPackage,
} from "./fixtures";

const OFFICIAL_FACTORY =
  "export default () => ({ kind: 'kaneo-plugin', apiVersion: 1, url: import.meta.url, options: undefined, schema: null });\n";

async function officialGantt() {
  const { root } = await writePluginPackage({
    name: "@kaneo/gantt",
    kaneo: { id: "gantt", name: "Gantt" },
    files: { "dist/index.js": OFFICIAL_FACTORY },
  });
  return join(root, "../../..");
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
});

describe("loadConfiguredPlugins", () => {
  it("loads official plugins without a config file", async () => {
    const officialBaseDir = await officialGantt();

    const loaded = await loadConfiguredPlugins({ officialBaseDir });
    expect(
      loaded.map(({ id, packageName, official }) => ({
        id,
        packageName,
        official,
      })),
    ).toEqual([{ id: "gantt", packageName: "@kaneo/gantt", official: true }]);
  });

  it("loads nothing when plugins are disabled", async () => {
    vi.stubEnv("DISABLE_PLUGINS", "true");

    expect(
      await loadConfiguredPlugins({ officialBaseDir: await createTempDir() }),
    ).toEqual([]);
  });

  it("loads official plugins before config plugins", async () => {
    const officialBaseDir = await officialGantt();
    await configWithPlugin({});

    const loaded = await loadConfiguredPlugins({ officialBaseDir });
    expect(loaded.map(({ id, official }) => [id, official])).toEqual([
      ["gantt", true],
      ["kaneo-plugin-progress", false],
    ]);
  });

  it("skips an official plugin the config turns off", async () => {
    await configWithPlugin(
      { name: "@acme/gantt", kaneo: { id: "gantt" } },
      "official: { gantt: false },",
    );

    const loaded = await loadConfiguredPlugins({
      officialBaseDir: await createTempDir(),
    });
    expect(
      loaded.map(({ packageName, official }) => [packageName, official]),
    ).toEqual([["@acme/gantt", false]]);
  });

  it("fails at start when a config plugin takes an official plugin's id", async () => {
    const officialBaseDir = await officialGantt();
    await configWithPlugin({ name: "@acme/gantt", kaneo: { id: "gantt" } });

    const error = await loadConfiguredPlugins({ officialBaseDir }).catch(
      (reason) => reason,
    );
    expect(error).toMatchObject({ name: "PluginLoadError" });
    expect(error).toMatchObject({ stage: "start", plugin: "@acme/gantt" });
    expect(error.hint).toContain("official: { gantt: false }");
  });

  it("fails at resolve when an official plugin cannot be imported", async () => {
    const officialBaseDir = await officialGantt();
    await writeFiles(officialBaseDir, {
      "node_modules/@kaneo/gantt/dist/index.js":
        "throw new Error('Cannot load @kaneo/gantt');\n",
    });

    const error = await loadConfiguredPlugins({ officialBaseDir }).catch(
      (reason) => reason,
    );
    expect(error).toMatchObject({ name: "PluginLoadError" });
    expect(error).toMatchObject({
      stage: "resolve",
      plugin: "@kaneo/gantt",
      message: "Cannot load @kaneo/gantt",
    });
    expect(error.hint).toContain("official: { gantt: false }");
  });
});
