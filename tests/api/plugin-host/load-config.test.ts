import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { loadConfig } from "../../../apps/api/src/plugin-host/config/load-config";
import { PluginLoadError } from "../../../apps/api/src/plugin-host/load-error";
import { createTempDir, removeTempDirs, writeFiles } from "./fixtures";

afterEach(removeTempDirs);

async function config(file: string, source: string) {
  const dir = await createTempDir();
  await writeFiles(dir, { [file]: source });
  return join(dir, file);
}

const OFFICIAL_IDS = ["gantt"];

async function configError(path: string) {
  const error = await loadConfig(path, OFFICIAL_IDS).then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(PluginLoadError);
  return error as PluginLoadError;
}

const DESCRIPTOR =
  '{ kind: "kaneo-plugin", apiVersion: 1, url: "file:///kaneo/node_modules/x/dist/index.js", options: { a: 1 }, schema: null }';

describe("loadConfig", () => {
  it("returns the declared plugin descriptors", async () => {
    const path = await config(
      "kaneo.config.mjs",
      `export default { plugins: [${DESCRIPTOR}] };`,
    );
    expect(await loadConfig(path, OFFICIAL_IDS)).toEqual({
      official: {},
      plugins: [
        {
          kind: "kaneo-plugin",
          apiVersion: 1,
          url: "file:///kaneo/node_modules/x/dist/index.js",
          options: { a: 1 },
          schema: null,
        },
      ],
    });
  });

  it("returns the built-in plugin toggles", async () => {
    const path = await config(
      "kaneo.config.mjs",
      "export default { official: { gantt: false } };",
    );
    expect(await loadConfig(path, OFFICIAL_IDS)).toEqual({
      official: { gantt: false },
      plugins: [],
    });
  });

  it("rejects unknown built-in plugins and non boolean toggles", async () => {
    const unknown = await config(
      "kaneo.config.mjs",
      "export default { official: { gant: false } };",
    );
    expect((await configError(unknown)).message).toBe(
      "official.gant is not a built-in plugin. Use one of: gantt.",
    );

    const invalid = await config(
      "kaneo.config.mjs",
      'export default { official: { gantt: "no" } };',
    );
    expect((await configError(invalid)).message).toBe(
      "official.gantt must be true or false.",
    );

    const notObject = await config(
      "kaneo.config.mjs",
      "export default { official: [] };",
    );
    expect((await configError(notObject)).message).toContain(
      '"official" must be an object',
    );
  });

  it("loads TypeScript configs", async () => {
    const path = await config(
      "kaneo.config.ts",
      "const config: { plugins: unknown[] } = { plugins: [] };\nexport default config;\n",
    );
    expect(await loadConfig(path, OFFICIAL_IDS)).toEqual({
      official: {},
      plugins: [],
    });
  });

  it("treats a config without plugins as empty", async () => {
    const path = await config("kaneo.config.mjs", "export default {};");
    expect(await loadConfig(path, OFFICIAL_IDS)).toEqual({
      official: {},
      plugins: [],
    });
  });

  it("requires a default export object", async () => {
    const path = await config("kaneo.config.mjs", "export const x = 1;");
    const error = await configError(path);
    expect(error.stage).toBe("config");
    expect(error.format()).toContain("defineConfig()");
    expect(error.format()).toContain(`Fix ${path}`);
  });

  it("rejects plugins that is not an array", async () => {
    const path = await config(
      "kaneo.config.mjs",
      "export default { plugins: {} };",
    );
    expect((await configError(path)).message).toBe(
      '"plugins" must be an array.',
    );
  });

  it("explains a factory passed without calling it", async () => {
    const path = await config(
      "kaneo.config.mjs",
      `export default { plugins: [${DESCRIPTOR}, () => null] };`,
    );
    expect((await configError(path)).message).toContain(
      "plugins[1] is a function",
    );
  });

  it("reports configs that fail to import", async () => {
    const path = await config(
      "kaneo.config.mjs",
      'import missing from "kaneo-plugin-that-is-not-installed";\nexport default { plugins: [missing()] };',
    );
    const error = await configError(path);
    expect(error.message).toContain("kaneo-plugin-that-is-not-installed");
  });
});
