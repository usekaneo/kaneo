import { describe, expect, it } from "vite-plus/test";
import {
  installArgs,
  npmEnv,
  releasesArgs,
} from "../../../apps/api/src/cli/commands/add/npm";
import { parseNpmView } from "../../../apps/api/src/cli/commands/add/parse-npm-view";

describe("npm commands", () => {
  it("asks npm for every stable release with fields that keep objects intact", () => {
    expect(releasesArgs("@acme/reports")).toEqual([
      "view",
      "@acme/reports@>=0.0.0",
      "name",
      "version",
      "engines",
      "deprecated",
      "--json",
    ]);
  });

  it("installs exact versions", () => {
    expect(installArgs(["a@1.0.0", "@kaneo/config@2.29.3"])).toEqual([
      "install",
      "--save-exact",
      "a@1.0.0",
      "@kaneo/config@2.29.3",
    ]);
  });

  it("points the npm cache at a writable directory", () => {
    const env = npmEnv(
      { PATH: "/bin", npm_config_cache: "/root/.npm" },
      "/tmp/c",
    );
    expect(env).toMatchObject({
      PATH: "/bin",
      npm_config_cache: "/tmp/c",
      npm_config_update_notifier: "false",
    });
  });
});

describe("parseNpmView", () => {
  it("reads an array of releases", () => {
    const stdout = JSON.stringify([
      {
        name: "left-pad",
        version: "1.2.0",
        deprecated: "use String.prototype.padStart()",
      },
      { name: "left-pad", version: "1.3.0", engines: { kaneo: ">=2" } },
    ]);
    expect(parseNpmView(stdout, "", 0)).toEqual({
      ok: true,
      releases: [
        {
          version: "1.2.0",
          engines: undefined,
          deprecated: "use String.prototype.padStart()",
        },
        { version: "1.3.0", engines: { kaneo: ">=2" }, deprecated: undefined },
      ],
    });
  });

  it("reads the single object npm prints for a package with one release", () => {
    const stdout = JSON.stringify({ name: "solo", version: "0.1.0" });
    expect(parseNpmView(stdout, "", 0)).toMatchObject({
      ok: true,
      releases: [{ version: "0.1.0" }],
    });
  });

  it("reads bare version strings", () => {
    expect(parseNpmView('"1.0.0"', "", 0)).toMatchObject({
      ok: true,
      releases: [{ version: "1.0.0" }],
    });
    expect(parseNpmView('["1.0.0", "1.1.0"]', "", 0)).toMatchObject({
      ok: true,
      releases: [{ version: "1.0.0" }, { version: "1.1.0" }],
    });
  });

  it("treats no matching stable release as an empty list", () => {
    const stdout = JSON.stringify({
      error: { code: "E404", summary: "No match found for version >=0.0.0" },
    });
    expect(parseNpmView(stdout, "", 1)).toEqual({ ok: true, releases: [] });
    expect(parseNpmView("", "", 0)).toEqual({ ok: true, releases: [] });
  });

  it("reports npm errors", () => {
    const stdout = JSON.stringify({
      error: {
        code: "E404",
        summary: "Not Found - GET https://registry.npmjs.org/nope - Not found",
        detail: "The requested resource could not be found.",
      },
    });
    expect(parseNpmView(stdout, "npm error code E404", 1)).toEqual({
      ok: false,
      message: "Not Found - GET https://registry.npmjs.org/nope - Not found",
    });
    expect(
      parseNpmView(
        "",
        "npm error code E401\nnpm error Unable to authenticate\n",
        1,
      ),
    ).toEqual({ ok: false, message: "Unable to authenticate" });
    expect(parseNpmView("not json", "", 1)).toEqual({
      ok: false,
      message: "npm view did not return JSON.",
    });
  });
});
