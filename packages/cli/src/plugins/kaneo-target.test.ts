import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { resolveKaneoTarget } from "./kaneo-target.js";

const none = { installationVersion: null, configPackageVersion: null };

describe("resolveKaneoTarget", () => {
  it("prefers --kaneo-version and normalizes it", () => {
    expect(
      resolveKaneoTarget({
        flag: " v2.38.0 ",
        installationVersion: "2.37.0",
        configPackageVersion: "2.36.0",
      }),
    ).toEqual(Result.succeed({ version: "2.38.0", source: "flag" }));
  });

  it("rejects a --kaneo-version that is not a version", () => {
    const result = resolveKaneoTarget({ ...none, flag: "latest" });
    expect(Result.isFailure(result) && result.failure.message).toBe(
      '--kaneo-version takes a Kaneo version such as 2.37.0, not "latest".',
    );
  });

  it("uses the installation, then the project's @kaneo/config", () => {
    expect(
      resolveKaneoTarget({
        flag: undefined,
        installationVersion: "2.37.0",
        configPackageVersion: "2.36.0",
      }),
    ).toEqual(Result.succeed({ version: "2.37.0", source: "installation" }));
    expect(
      resolveKaneoTarget({
        flag: undefined,
        installationVersion: null,
        configPackageVersion: "2.36.0",
      }),
    ).toEqual(Result.succeed({ version: "2.36.0", source: "config-package" }));
  });

  it("explains the three ways to give the version", () => {
    const result = resolveKaneoTarget({ ...none, flag: undefined });
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "Could not tell which Kaneo version the plugins are for. Pass --kaneo-version with the Kaneo version you run, run the command inside a Kaneo installation such as the Kaneo Docker image, or install @kaneo/config for your Kaneo version in the project.",
    );
  });
});
