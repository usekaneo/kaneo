import { describe, expect, it } from "vite-plus/test";
import { relativeTime } from "./relative-time.js";

const now = new Date(2026, 9, 8, 12, 0, 0);
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("relativeTime", () => {
  it("counts recent minutes, hours and days", () => {
    expect(relativeTime(ago(20 * 1000), now)).toBe("just now");
    expect(relativeTime(ago(5 * 60 * 1000), now)).toBe("5m ago");
    expect(relativeTime(ago(3 * 60 * 60 * 1000), now)).toBe("3h ago");
    expect(relativeTime(ago(2 * 24 * 60 * 60 * 1000), now)).toBe("2d ago");
  });

  it("switches to a date after a week", () => {
    expect(relativeTime(new Date(2026, 8, 20, 9).toISOString(), now)).toBe(
      "Sep 20",
    );
    expect(relativeTime(new Date(2025, 11, 31, 9).toISOString(), now)).toBe(
      "Dec 31, 2025",
    );
  });

  it("treats clock skew as just now", () => {
    expect(relativeTime(ago(-30 * 1000), now)).toBe("just now");
  });
});
