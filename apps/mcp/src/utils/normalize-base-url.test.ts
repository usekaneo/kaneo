import { describe, expect, it } from "vitest";
import { normalizeBaseUrl } from "./normalize-base-url.js";

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes", () => {
    // Arrange
    const input = "http://localhost:1337/";

    // Act
    const result = normalizeBaseUrl(input);

    // Assert
    expect(result).toBe("http://localhost:1337");
  });

  it("removes /api suffix from path", () => {
    // Arrange
    const input = "http://localhost:1337/api";

    // Act
    const result = normalizeBaseUrl(input);

    // Assert
    expect(result).toBe("http://localhost:1337");
  });
});
