import { describe, expect, it } from "vite-plus/test";
import { isWebUrl, normalizeLinkUrl } from "./link-url";

describe("normalizeLinkUrl", () => {
  it("adds https to a bare address", () => {
    expect(normalizeLinkUrl(" example.com/docs ")).toBe(
      "https://example.com/docs",
    );
    expect(normalizeLinkUrl("example.com:8080")).toBe(
      "https://example.com:8080",
    );
  });

  it("keeps web and app links as typed", () => {
    expect(normalizeLinkUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeLinkUrl("obsidian://open?vault=Agents")).toBe(
      "obsidian://open?vault=Agents",
    );
    expect(normalizeLinkUrl("mailto:team@example.com")).toBe(
      "mailto:team@example.com",
    );
  });
});

describe("isWebUrl", () => {
  it("tells web links from app links", () => {
    expect(isWebUrl("HTTPS://example.com")).toBe(true);
    expect(isWebUrl("obsidian://open?vault=Agents")).toBe(false);
  });
});
