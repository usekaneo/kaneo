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
    expect(normalizeLinkUrl("localhost:3000")).toBe("https://localhost:3000");
    expect(normalizeLinkUrl("192.168.1.10:8080/admin")).toBe(
      "https://192.168.1.10:8080/admin",
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
    expect(normalizeLinkUrl("tel:5551234")).toBe("tel:5551234");
    expect(normalizeLinkUrl("facetime:5551234")).toBe("facetime:5551234");
    expect(normalizeLinkUrl("sms:+15551234567")).toBe("sms:+15551234567");
    expect(normalizeLinkUrl("spotify:track:4uLU6hMCjMI75M1A2tKUQC")).toBe(
      "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
    );
    expect(normalizeLinkUrl("geo:37.78,-122.41")).toBe("geo:37.78,-122.41");
  });
});

describe("isWebUrl", () => {
  it("tells web links from app links", () => {
    expect(isWebUrl("HTTPS://example.com")).toBe(true);
    expect(isWebUrl("obsidian://open?vault=Agents")).toBe(false);
  });
});
