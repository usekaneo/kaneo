import { describe, expect, it } from "vite-plus/test";
import { formatWait, retryAfterMs } from "./retry-after.js";

describe("retryAfterMs", () => {
  it("reads delay seconds", () => {
    expect(retryAfterMs("42")).toBe(42_000);
  });

  it("reads an HTTP date relative to now", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(retryAfterMs("Thu, 01 Jan 2026 00:00:30 GMT", now)).toBe(30_000);
  });

  it("returns null for a missing or unparseable header", () => {
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs("soon")).toBeNull();
  });
});

describe("formatWait", () => {
  it("uses the coarsest readable unit", () => {
    expect(formatWait(45_000)).toBe("45s");
    expect(formatWait(10 * 60_000)).toBe("10 min");
    expect(formatWait(20 * 3_600_000)).toBe("20 h");
  });
});
