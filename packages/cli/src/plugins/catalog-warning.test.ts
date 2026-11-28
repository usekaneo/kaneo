import { describe, expect, it } from "vite-plus/test";
import { catalogWarning } from "./catalog-warning.js";

describe("catalogWarning", () => {
  it("warns about unlisted packages and an unreachable catalog", () => {
    expect(catalogWarning("kaneo-plugin-x", { status: "unlisted" })).toBe(
      "kaneo-plugin-x is not listed in the Kaneo plugin catalog. Plugins run with full access to Kaneo, so only add packages you trust.",
    );
    expect(
      catalogWarning("kaneo-plugin-x", {
        status: "unavailable",
        reason: "fetch failed",
      }),
    ).toBe(
      "Could not check the Kaneo plugin catalog: fetch failed. Only add packages you trust.",
    );
  });
});
