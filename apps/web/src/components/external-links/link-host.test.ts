import { describe, expect, it } from "vite-plus/test";
import { linkHost } from "./link-host";

describe("linkHost", () => {
  it("shows the domain without a leading www", () => {
    expect(linkHost("https://www.example.com/docs/rate-limits")).toBe(
      "example.com",
    );
  });

  it("keeps subdomains other than www", () => {
    expect(linkHost("https://wiki.example.com/page")).toBe("wiki.example.com");
  });

  it("returns null for a value that is not a URL", () => {
    expect(linkHost("not a url")).toBeNull();
  });
});
