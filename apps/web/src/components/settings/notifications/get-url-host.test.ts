import { describe, expect, it } from "vite-plus/test";
import { getUrlHost } from "./get-url-host";

describe("getUrlHost", () => {
  it("returns the host of a URL, keeping a custom port", () => {
    expect(getUrlHost("https://gotify.example.com/path?x=1")).toBe(
      "gotify.example.com",
    );
    expect(getUrlHost("http://ntfy.example.com:8080")).toBe(
      "ntfy.example.com:8080",
    );
  });

  it("falls back to the raw value when it is not a URL", () => {
    expect(getUrlHost("  ntfy.local  ")).toBe("ntfy.local");
  });

  it("returns null for empty values", () => {
    expect(getUrlHost(null)).toBeNull();
    expect(getUrlHost(undefined)).toBeNull();
    expect(getUrlHost("   ")).toBeNull();
  });
});
