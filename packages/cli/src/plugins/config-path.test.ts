import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { resolveConfigPath } from "./config-path.js";

const existing = (paths: string[]) => (path: string) => paths.includes(path);
const base = { cwd: "/home/me", projectDir: "/srv/project" };

describe("resolveConfigPath", () => {
  it("uses --config when the file exists", () => {
    expect(
      resolveConfigPath({
        ...base,
        flag: "conf/kaneo.config.ts",
        exists: existing(["/home/me/conf/kaneo.config.ts"]),
      }),
    ).toEqual(Result.succeed("/home/me/conf/kaneo.config.ts"));
  });

  it("fails when --config points to a missing file", () => {
    const result = resolveConfigPath({
      ...base,
      flag: "missing.ts",
      exists: () => false,
    });
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "--config points to /home/me/missing.ts, which does not exist.",
    );
  });

  it("finds a config in the project directory or returns null", () => {
    expect(
      resolveConfigPath({
        ...base,
        flag: undefined,
        exists: existing([
          "/srv/project/kaneo.config.js",
          "/srv/project/kaneo.config.mjs",
        ]),
      }),
    ).toEqual(Result.succeed("/srv/project/kaneo.config.js"));
    expect(
      resolveConfigPath({ ...base, flag: undefined, exists: () => false }),
    ).toEqual(Result.succeed(null));
  });
});
