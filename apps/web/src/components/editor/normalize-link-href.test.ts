import { describe, expect, it } from "vite-plus/test";
import { normalizeLinkHref } from "./normalize-link-href";

describe("normalizeLinkHref", () => {
  it("adds https to bare domains", () => {
    expect(normalizeLinkHref(" andrje.sh ")).toBe("https://andrje.sh");
    expect(normalizeLinkHref("kaneo.app/docs?x=1")).toBe(
      "https://kaneo.app/docs?x=1",
    );
  });

  it("keeps links that already have a scheme or are relative", () => {
    expect(normalizeLinkHref("http://localhost:5173")).toBe(
      "http://localhost:5173",
    );
    expect(normalizeLinkHref("mailto:john@example.com")).toBe(
      "mailto:john@example.com",
    );
    expect(normalizeLinkHref("/dashboard")).toBe("/dashboard");
    expect(normalizeLinkHref("#notes")).toBe("#notes");
  });

  it("turns email addresses into mailto links", () => {
    expect(normalizeLinkHref("john.doe@example.com")).toBe(
      "mailto:john.doe@example.com",
    );
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeLinkHref("   ")).toBe("");
  });
});
