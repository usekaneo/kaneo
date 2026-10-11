import { describe, expect, it } from "vite-plus/test";
import {
  installArgs,
  lastErrorLine,
  npmCommand,
  npmEnv,
  releasesArgs,
} from "./npm-args.js";

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

  it("installs exact versions without running install scripts", () => {
    expect(installArgs(["a@1.0.0", "@kaneo/config@2.29.3"])).toEqual([
      "install",
      "--save-exact",
      "--ignore-scripts",
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

describe("npmCommand", () => {
  it("runs npm directly, and through the shell with quoted arguments on Windows", () => {
    const args = releasesArgs("kaneo-plugin-x");
    expect(npmCommand("linux", args)).toEqual({
      command: "npm",
      args,
      shell: false,
    });
    expect(npmCommand("win32", ["view", "x@>=0.0.0"])).toEqual({
      command: "npm",
      args: ['"view"', '"x@>=0.0.0"'],
      shell: true,
    });
  });
});

describe("lastErrorLine", () => {
  it("returns the last npm error without its prefix", () => {
    expect(
      lastErrorLine("npm error code E401\nnpm error Unable to authenticate\n"),
    ).toBe("Unable to authenticate");
    expect(lastErrorLine("npm ERR! code E404\n")).toBe("code E404");
    expect(lastErrorLine("\n")).toBeNull();
  });
});
