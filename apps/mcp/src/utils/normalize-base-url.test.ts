import { describe, expect, it } from "vitest";
import { normalizeBaseUrl } from "./normalize-base-url.js";

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeBaseUrl("http://localhost:1337/")).toBe(
      "http://localhost:1337",
    );
  });

  it("removes /api suffix from path", () => {
    expect(normalizeBaseUrl("http://localhost:1337/api")).toBe(
      "http://localhost:1337",
    );
  });
});
