import { describe, expect, it } from "vitest";
import { resolveClientOrigin } from "./resolve-client-origin";

describe("resolveClientOrigin", () => {
  const browserOrigin = "https://served.example.test";

  it.each([undefined, "", "   ", "KANEO_CLIENT_URL"])(
    "falls back for an unset runtime placeholder (%s)",
    (configuredOrigin) => {
      expect(resolveClientOrigin(configuredOrigin, browserOrigin)).toBe(
        browserOrigin,
      );
    },
  );

  it.each([
    "https://configured.example.test/path",
    "javascript:alert(1)",
    "https://user:pass@configured.example.test",
    "not a URL",
  ])("falls back for a non-origin value (%s)", (configuredOrigin) => {
    expect(resolveClientOrigin(configuredOrigin, browserOrigin)).toBe(
      browserOrigin,
    );
  });

  it("normalizes a configured HTTP(S) origin", () => {
    expect(
      resolveClientOrigin("https://configured.example.test/", browserOrigin),
    ).toBe("https://configured.example.test");
  });
});
