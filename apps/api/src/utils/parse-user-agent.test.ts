import { describe, expect, it } from "vite-plus/test";
import { parseUserAgent } from "./parse-user-agent";

describe("parseUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      { browser: "Safari", os: "iPhone" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1",
      { browser: "Chrome", os: "iPhone" },
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      { browser: "Chrome", os: "macOS" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
      { browser: "Edge", os: "Windows" },
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
      { browser: "Firefox", os: "Linux" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
      { browser: "Chrome", os: "Android" },
    ],
  ])("describes %s", (userAgent, expected) => {
    expect(parseUserAgent(userAgent)).toEqual(expected);
  });

  it("keeps the part it recognizes", () => {
    expect(parseUserAgent("curl/8.7.1 (Windows)")).toEqual({
      browser: undefined,
      os: "Windows",
    });
  });

  it("returns nothing for unknown or missing agents", () => {
    expect(parseUserAgent("kaneo-cli/0.1.1")).toBeUndefined();
    expect(parseUserAgent(undefined)).toBeUndefined();
    expect(parseUserAgent("")).toBeUndefined();
  });
});
