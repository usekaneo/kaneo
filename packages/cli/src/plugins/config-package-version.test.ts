import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  createTempDir,
  removeTempDirs,
  writeFiles,
} from "../testing/plugin-project.js";
import { configPackageVersion } from "./config-package-version.js";

afterEach(removeTempDirs);

describe("configPackageVersion", () => {
  it("reads the installed @kaneo/config version", async () => {
    const dir = await createTempDir();
    await writeFiles(dir, {
      "node_modules/@kaneo/config/package.json": JSON.stringify({
        name: "@kaneo/config",
        version: "2.36.1",
      }),
    });
    expect(configPackageVersion(dir)).toBe("2.36.1");
  });

  it("returns null when it is not installed", async () => {
    expect(configPackageVersion(await createTempDir())).toBeNull();
  });
});
