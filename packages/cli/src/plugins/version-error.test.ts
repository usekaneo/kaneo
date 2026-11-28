import { describe, expect, it } from "vite-plus/test";
import { versionError } from "./version-error.js";

const PACKAGE = "kaneo-plugin-time-report";

describe("versionError", () => {
  it("names the newest range when no release fits", () => {
    expect(
      versionError(PACKAGE, "1.5.0", {
        status: "incompatible",
        newest: "2.0.0",
        range: ">=3",
      }).message,
    ).toBe(
      `No release of ${PACKAGE} supports Kaneo 1.5.0. The newest, 2.0.0, supports Kaneo >=3.`,
    );
  });

  it("explains a package that never declares engines.kaneo", () => {
    const error = versionError(PACKAGE, "2.29.3", {
      status: "no-engines",
      newest: "1.0.0",
    });
    expect(error.message).toContain("declares engines.kaneo");
    expect(error.hint).toContain("kaneo plugin check");
  });

  it("reports packages without usable releases", () => {
    expect(
      versionError(PACKAGE, "2.29.3", { status: "no-stable" }).message,
    ).toBe(`${PACKAGE} has no stable release on npm.`);
    expect(
      versionError(PACKAGE, "2.29.3", {
        status: "all-deprecated",
        newest: "1.0.0",
      }).message,
    ).toContain("deprecated");
  });
});
