import { describe, expect, it } from "vite-plus/test";
import { formatUptime } from "./format-uptime";

describe("formatUptime", () => {
  it("shows the two largest units", () => {
    expect(formatUptime(3 * 86_400 + 4 * 3_600 + 59)).toBe("3d 4h");
    expect(formatUptime(4 * 3_600 + 12 * 60 + 5)).toBe("4h 12m");
  });

  it("falls back to minutes and seconds for a fresh start", () => {
    expect(formatUptime(12 * 60 + 30)).toBe("12m");
    expect(formatUptime(42)).toBe("42s");
    expect(formatUptime(0)).toBe("0s");
  });
});
