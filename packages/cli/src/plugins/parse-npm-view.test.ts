import { describe, expect, it } from "vite-plus/test";
import { parseNpmView } from "./parse-npm-view.js";

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
