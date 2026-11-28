import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { findKaneoInstallation } from "./kaneo-installation.js";
import {
  createTempDir,
  removeTempDirs,
  writeFiles,
} from "./testing/fixtures.js";

afterEach(removeTempDirs);

describe("findKaneoInstallation", () => {
  it("returns the root and version of the enclosing kaneo package", async () => {
    const root = await createTempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({ name: "kaneo", version: "2.37.0" }),
      "packages/cli/package.json": JSON.stringify({ name: "@kaneo/cli" }),
      "packages/cli/dist/.keep": "",
    });
    expect(findKaneoInstallation(join(root, "packages/cli/dist"))).toEqual({
      root,
      version: "2.37.0",
    });
  });

  it("ignores a kaneo package without a version", async () => {
    const root = await createTempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({ name: "kaneo" }),
    });
    expect(findKaneoInstallation(root)).toBeNull();
  });
});
