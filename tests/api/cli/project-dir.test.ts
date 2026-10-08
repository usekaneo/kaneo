import { describe, expect, it } from "vite-plus/test";
import { CliError } from "../../../apps/api/src/cli/cli-error";
import { resolveProjectDir } from "../../../apps/api/src/cli/project-dir";
import { resolveConfigPath } from "../../../apps/api/src/cli/resolve-config-path";
import { PluginLoadError } from "../../../apps/api/src/plugin-host/load-error";

const existing = (paths: string[]) => (path: string) => paths.includes(path);

describe("resolveProjectDir", () => {
  it("prefers --project, resolved against the working directory", () => {
    expect(
      resolveProjectDir({
        flag: "../my-kaneo",
        env: "/env/dir",
        cwd: "/home/me/work",
        exists: existing(["/kaneo"]),
      }),
    ).toBe("/home/me/my-kaneo");
  });

  it("falls back to KANEO_PROJECT_DIR", () => {
    expect(
      resolveProjectDir({
        flag: undefined,
        env: " /srv/kaneo ",
        cwd: "/home/me",
        exists: existing(["/kaneo"]),
      }),
    ).toBe("/srv/kaneo");
  });

  it("uses /kaneo when it exists, else the working directory", () => {
    expect(
      resolveProjectDir({
        flag: undefined,
        env: "",
        cwd: "/home/me",
        exists: existing(["/kaneo"]),
      }),
    ).toBe("/kaneo");
    expect(
      resolveProjectDir({
        flag: "  ",
        env: undefined,
        cwd: "/home/me",
        exists: () => false,
      }),
    ).toBe("/home/me");
  });
});

describe("resolveConfigPath", () => {
  const base = { cwd: "/home/me", projectDir: "/srv/project", env: undefined };

  it("uses --config when the file exists", () => {
    expect(
      resolveConfigPath({
        ...base,
        flag: "conf/kaneo.config.ts",
        env: "/elsewhere/kaneo.config.ts",
        exists: existing(["/home/me/conf/kaneo.config.ts"]),
      }),
    ).toBe("/home/me/conf/kaneo.config.ts");
  });

  it("fails when --config points to a missing file", () => {
    expect(() =>
      resolveConfigPath({ ...base, flag: "missing.ts", exists: () => false }),
    ).toThrow(CliError);
  });

  it("uses KANEO_CONFIG before the project directory", () => {
    expect(
      resolveConfigPath({
        ...base,
        flag: undefined,
        env: "/etc/kaneo/kaneo.config.mjs",
        exists: existing([
          "/etc/kaneo/kaneo.config.mjs",
          "/srv/project/kaneo.config.ts",
        ]),
      }),
    ).toBe("/etc/kaneo/kaneo.config.mjs");
    expect(() =>
      resolveConfigPath({
        ...base,
        flag: undefined,
        env: "/missing.ts",
        exists: () => false,
      }),
    ).toThrow(PluginLoadError);
  });

  it("finds a config in the project directory or returns null", () => {
    expect(
      resolveConfigPath({
        ...base,
        flag: undefined,
        exists: existing(["/srv/project/kaneo.config.js"]),
      }),
    ).toBe("/srv/project/kaneo.config.js");
    expect(
      resolveConfigPath({ ...base, flag: undefined, exists: () => false }),
    ).toBeNull();
  });
});
