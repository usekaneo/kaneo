import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  configSource,
  createTempDir,
  removeTempDirs,
  writeFiles,
  writePluginPackage,
} from "../testing/fixtures.js";
import { loadDeclaredPlugins } from "./load-declared-plugins.js";

afterEach(removeTempDirs);

async function installation() {
  const { dir } = await writePluginPackage({
    name: "@kaneo/gantt",
    kaneo: { id: "gantt" },
  });
  return dir;
}

async function config(source: string) {
  const dir = await createTempDir();
  await writeFiles(dir, { "kaneo.config.mjs": source });
  return join(dir, "kaneo.config.mjs");
}

describe("loadDeclaredPlugins", () => {
  it("puts built-in plugins before the configured ones", async () => {
    const baseDir = await installation();
    const plugin = await writePluginPackage();
    const declared = await loadDeclaredPlugins(
      await config(configSource([plugin.url])),
      { officialBaseDir: baseDir },
    );
    expect(declared.descriptors.map((entry) => entry.url)).toEqual([
      expect.stringContaining("@kaneo/gantt"),
      plugin.url,
    ]);
    expect([...declared.official].map((entry) => entry.url)).toEqual([
      expect.stringContaining("@kaneo/gantt"),
    ]);
    expect(declared.skippedOfficial).toEqual([]);
  });

  it("leaves out built-in plugins the config turns off", async () => {
    const declared = await loadDeclaredPlugins(
      await config(configSource([], "official: { gantt: false },")),
      { officialBaseDir: await createTempDir() },
    );
    expect(declared.descriptors).toEqual([]);
    expect(declared.skippedOfficial).toEqual([]);
  });

  it("reports the built-in plugins it skips without an installation", async () => {
    const declared = await loadDeclaredPlugins(null, {
      officialBaseDir: null,
    });
    expect(declared.descriptors).toEqual([]);
    expect(declared.skippedOfficial).toEqual([
      { id: "gantt", packageName: "@kaneo/gantt" },
    ]);
  });
});
