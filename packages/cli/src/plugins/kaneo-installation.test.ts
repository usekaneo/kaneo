import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  createTempDir,
  removeTempDirs,
  writeFiles,
  writeInstallation,
} from "../testing/plugin-project.js";
import { findInstallation } from "./kaneo-installation.js";

afterEach(removeTempDirs);

describe("findInstallation", () => {
  it("finds the installation the CLI runs from and its API directory", async () => {
    const root = await writeInstallation("2.37.0");
    expect(
      findInstallation([join(root, "packages/cli/dist"), "/elsewhere"]),
    ).toEqual({
      root,
      version: "2.37.0",
      officialBaseDir: join(root, "apps/api"),
    });
  });

  it("falls back to the next directory and needs apps/api for built-ins", async () => {
    const outside = await createTempDir();
    const root = await createTempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({ name: "kaneo", version: "2.36.0" }),
    });
    expect(findInstallation([null, outside, root])).toEqual({
      root,
      version: "2.36.0",
      officialBaseDir: null,
    });
  });

  it("returns null outside a Kaneo installation", async () => {
    expect(findInstallation([await createTempDir()])).toBeNull();
  });
});
