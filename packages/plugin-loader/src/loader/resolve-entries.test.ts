import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  removeTempDirs,
  type PluginPackageOptions,
  writePluginPackage,
} from "../testing/fixtures.js";
import { resolveEntries } from "./resolve-entries.js";
import { resolvePackage } from "./resolve-package.js";

const SHARED_FOLDER_FILES = {
  "dist/web.js": "export default {};\n",
  "dist/chunks/shared.js": "export const shared = 1;\n",
};

async function resolveFixture(options: PluginPackageOptions = {}) {
  const { url } = await writePluginPackage(options);
  const { root, plugin, factory } = await resolvePackage(url);
  return { root, run: () => resolveEntries(root, plugin, factory) };
}

afterEach(async () => {
  await removeTempDirs();
});

describe("resolveEntries", () => {
  it("serves web assets from a folder of their own", async () => {
    const { root, run } = await resolveFixture();

    expect(await run()).toEqual({
      root,
      server: join(root, "dist/server.js"),
      web: {
        root: join(root, "dist/web"),
        entry: "index.js",
        styles: null,
        excluded: [join(root, "dist/server.js")],
      },
    });
  });

  it("rejects a web folder that contains the server entry", async () => {
    const { run } = await resolveFixture({
      exports: {
        ".": "./dist/index.js",
        "./server": "./dist/server.js",
        "./web": "./dist/web.js",
      },
      files: SHARED_FOLDER_FILES,
    });

    await expect(run()).rejects.toThrow(
      "Move the ./web export into its own folder; the web folder must not contain server code (./server is inside it).",
    );
  });

  it("rejects a web folder that contains the factory entry", async () => {
    const { run } = await resolveFixture({
      exports: {
        ".": "./dist/index.js",
        "./web": "./dist/web.js",
      },
      files: SHARED_FOLDER_FILES,
    });

    await expect(run()).rejects.toThrow(
      'Move the ./web export into its own folder; the web folder must not contain server code (the "." entry is inside it).',
    );
  });

  it("rejects a web entry at the package root", async () => {
    const { run } = await resolveFixture({
      exports: {
        ".": "./dist/index.js",
        "./web": "./web.js",
      },
      files: { "web.js": "export default {};\n" },
    });

    await expect(run()).rejects.toThrow(
      'Move the ./web export into its own folder; the web folder must not contain server code (the "." entry is inside it).',
    );
  });
});
