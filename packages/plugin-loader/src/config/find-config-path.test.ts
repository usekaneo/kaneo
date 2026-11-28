import { describe, expect, it } from "vite-plus/test";
import { findConfigPath } from "./find-config-path.js";
import { PluginLoadError } from "../load-error.js";

const existing = (paths: string[]) => (path: string) => paths.includes(path);

describe("findConfigPath", () => {
  it("resolves KANEO_CONFIG relative to the working directory", () => {
    expect(
      findConfigPath({
        configEnv: "../config/kaneo.config.ts",
        cwd: "/srv/kaneo/app",
        exists: existing(["/srv/kaneo/config/kaneo.config.ts"]),
      }),
    ).toBe("/srv/kaneo/config/kaneo.config.ts");
  });

  it("fails when KANEO_CONFIG points to a missing file", () => {
    let thrown: unknown;
    try {
      findConfigPath({
        configEnv: "/missing/kaneo.config.ts",
        exists: existing(["/kaneo/kaneo.config.ts"]),
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PluginLoadError);
    expect((thrown as PluginLoadError).stage).toBe("config");
    expect((thrown as PluginLoadError).message).toContain(
      "/missing/kaneo.config.ts",
    );
  });

  it("uses the first default config that exists", () => {
    expect(
      findConfigPath({
        configEnv: "",
        exists: existing(["/kaneo/kaneo.config.js", "/kaneo/kaneo.config.mjs"]),
      }),
    ).toBe("/kaneo/kaneo.config.js");
    expect(
      findConfigPath({
        configEnv: undefined,
        exists: existing(["/kaneo/kaneo.config.ts", "/kaneo/kaneo.config.js"]),
      }),
    ).toBe("/kaneo/kaneo.config.ts");
  });

  it("returns null when there is no config", () => {
    expect(findConfigPath({ configEnv: "  ", exists: () => false })).toBeNull();
  });
});
