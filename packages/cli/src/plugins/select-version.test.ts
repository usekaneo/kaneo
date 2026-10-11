import { describe, expect, it } from "vite-plus/test";
import { type PackageRelease, selectVersion } from "./select-version.js";

const kaneo = (range: string) => ({ kaneo: range });

describe("selectVersion", () => {
  it("picks the newest stable release whose range includes Kaneo", () => {
    const releases: PackageRelease[] = [
      { version: "1.0.0", engines: kaneo(">=2.20.0 <3") },
      { version: "1.2.0", engines: kaneo(">=2.31.0 <3") },
      { version: "1.1.0", engines: kaneo(">=2.29.0 <3") },
      { version: "1.1.5", engines: kaneo(">=2.29.0 <3") },
    ];
    expect(selectVersion(releases, "2.29.3")).toEqual({
      status: "ok",
      version: "1.1.5",
      range: ">=2.29.0 <3",
    });
  });

  it("skips prereleases, deprecated releases, and releases without engines.kaneo", () => {
    const releases: PackageRelease[] = [
      { version: "2.0.0-beta.1", engines: kaneo(">=2") },
      { version: "1.3.0", engines: kaneo(">=2"), deprecated: "broken" },
      { version: "1.2.0", engines: { node: ">=20" } },
      { version: "1.1.0", engines: kaneo(">=2") },
    ];
    expect(selectVersion(releases, "2.29.3")).toMatchObject({
      status: "ok",
      version: "1.1.0",
    });
  });

  it("matches prerelease Kaneo versions", () => {
    expect(
      selectVersion(
        [{ version: "1.0.0", engines: kaneo(">=2.29.0 <4") }],
        "3.0.0-rc.1",
      ),
    ).toMatchObject({ status: "ok", version: "1.0.0" });
  });

  it("treats an empty deprecation message as not deprecated", () => {
    expect(
      selectVersion(
        [{ version: "1.0.0", engines: kaneo(">=2"), deprecated: "" }],
        "2.29.3",
      ),
    ).toMatchObject({ status: "ok", version: "1.0.0" });
  });

  it("reports the newest range when no release fits", () => {
    expect(
      selectVersion(
        [
          { version: "1.0.0", engines: kaneo(">=1 <2") },
          { version: "2.0.0", engines: kaneo(">=3") },
          { version: "2.1.0", engines: kaneo("not a range") },
        ],
        "2.29.3",
      ),
    ).toEqual({
      status: "incompatible",
      newest: "2.1.0",
      range: "not a range",
    });
  });

  it("explains when no release declares engines.kaneo", () => {
    expect(
      selectVersion(
        [
          { version: "1.0.0" },
          { version: "1.1.0", engines: { node: ">=20" } },
          { version: "1.2.0", engines: [">=2"] },
        ],
        "2.29.3",
      ),
    ).toEqual({ status: "no-engines", newest: "1.2.0" });
  });

  it("reports packages with only prereleases or only deprecated releases", () => {
    expect(selectVersion([], "2.29.3")).toEqual({ status: "no-stable" });
    expect(
      selectVersion(
        [{ version: "1.0.0-alpha.1" }, { version: "nope" }],
        "2.29.3",
      ),
    ).toEqual({ status: "no-stable" });
    expect(
      selectVersion(
        [
          { version: "1.0.0", deprecated: "old", engines: kaneo(">=2") },
          { version: "0.9.0", deprecated: true, engines: kaneo(">=2") },
        ],
        "2.29.3",
      ),
    ).toEqual({ status: "all-deprecated", newest: "1.0.0" });
  });
});
