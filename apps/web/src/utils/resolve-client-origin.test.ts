import { describe, expect, it } from "vitest";
import { resolveClientOrigin } from "./resolve-client-origin";

describe("resolveClientOrigin", () => {
  it.each([undefined, "", "   ", "KANEO_CLIENT_URL"])(
    "falls back for an unset runtime placeholder (%s)",
    (configuredOrigin) => {
      // Arrange
      const browserOrigin = "https://served.example.test";

      // Act
      const resolvedOrigin = resolveClientOrigin(
        configuredOrigin,
        browserOrigin,
      );

      // Assert
      expect(resolvedOrigin).toBe(browserOrigin);
    },
  );

  it.each([
    "https://configured.example.test/path",
    "javascript:alert(1)",
    "https://user:pass@configured.example.test",
    "not a URL",
  ])("falls back for a non-origin value (%s)", (configuredOrigin) => {
    // Arrange
    const browserOrigin = "https://served.example.test";

    // Act
    const resolvedOrigin = resolveClientOrigin(configuredOrigin, browserOrigin);

    // Assert
    expect(resolvedOrigin).toBe(browserOrigin);
  });

  it("normalizes a configured HTTP(S) origin", () => {
    // Arrange
    const configuredOrigin = "https://configured.example.test/";
    const browserOrigin = "https://served.example.test";

    // Act
    const resolvedOrigin = resolveClientOrigin(configuredOrigin, browserOrigin);

    // Assert
    expect(resolvedOrigin).toBe("https://configured.example.test");
  });
});
