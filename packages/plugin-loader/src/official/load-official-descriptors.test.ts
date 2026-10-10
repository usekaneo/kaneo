import { afterEach, describe, expect, it } from "vite-plus/test";
import { PluginLoadError } from "../load-error.js";
import {
  createTempDir,
  removeTempDirs,
  writePluginPackage,
} from "../testing/fixtures.js";
import { loadOfficialDescriptors } from "./load-official-descriptors.js";
import type { OfficialPlugin } from "./official-plugins.js";

afterEach(removeTempDirs);

const GANTT: OfficialPlugin = { id: "gantt", packageName: "@kaneo/gantt" };

async function loadError(
  baseDir: string,
  plugin: OfficialPlugin = GANTT,
): Promise<PluginLoadError> {
  const error = await loadOfficialDescriptors([plugin], baseDir).then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(PluginLoadError);
  return error as PluginLoadError;
}

describe("loadOfficialDescriptors", () => {
  it("resolves built-in plugins from the Kaneo installation directory", async () => {
    const { dir, url } = await writePluginPackage({ name: "@kaneo/gantt" });
    expect(await loadOfficialDescriptors([GANTT], dir)).toEqual([
      {
        kind: "kaneo-plugin",
        apiVersion: 1,
        url,
        options: undefined,
        schema: null,
      },
    ]);
  });

  it("fails at resolve with a hint when the package is missing", async () => {
    const dir = await createTempDir();
    const missing = {
      id: "missing",
      packageName: "@kaneo/plugin-that-is-not-installed",
    };
    const error = await loadError(dir, missing);
    expect(error).toMatchObject({
      stage: "resolve",
      plugin: missing.packageName,
      message: `Cannot find package '${missing.packageName}' from ${dir}.`,
    });
    expect(error.hint).toContain("official: { missing: false }");
  });

  it("fails when the default export is not a plugin factory", async () => {
    const { dir } = await writePluginPackage({
      name: "@kaneo/gantt",
      files: { "dist/index.js": "export default 42;\n" },
    });
    expect((await loadError(dir)).message).toBe(
      "@kaneo/gantt does not export a plugin factory as its default export.",
    );
  });
});
