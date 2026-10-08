import { describe, expect, it } from "vite-plus/test";
import { relativeTime } from "./relative-time.js";

const now = new Date(2026, 9, 8, 15, 0, 0);
const at = (...parts: [number, number, number, number?, number?]) =>
  new Date(parts[0], parts[1], parts[2], parts[3] ?? 0, parts[4] ?? 0);

describe("relativeTime", () => {
  it("says just now for the last minute", () => {
    expect(relativeTime(new Date(now.getTime() - 20_000), now)).toBe(
      "just now",
    );
  });

  it("treats a small clock skew into the future as just now", () => {
    expect(relativeTime(new Date(now.getTime() + 30_000), now)).toBe(
      "just now",
    );
  });

  it("counts minutes within the hour", () => {
    expect(relativeTime(at(2026, 9, 8, 14, 15), now)).toBe("45m ago");
  });

  it("counts hours earlier the same day", () => {
    expect(relativeTime(at(2026, 9, 8, 12, 0), now)).toBe("3h ago");
    expect(relativeTime(at(2026, 9, 8, 0, 30), now)).toBe("14h ago");
  });

  it("counts hours across midnight when it was recent", () => {
    const early = at(2026, 9, 8, 1, 0);
    expect(relativeTime(at(2026, 9, 7, 22, 0), early)).toBe("3h ago");
  });

  it("says Yesterday for the previous day", () => {
    expect(relativeTime(at(2026, 9, 7, 9, 0), now)).toBe("Yesterday");
  });

  it("counts days within the week", () => {
    expect(relativeTime(at(2026, 9, 5, 9, 0), now)).toBe("3d ago");
  });

  it("shows the date after a week", () => {
    expect(relativeTime(at(2026, 9, 1, 9, 0), now)).toBe("Oct 1");
    expect(relativeTime(at(2026, 0, 2, 9, 0), now)).toBe("Jan 2");
  });

  it("adds the year for other years", () => {
    expect(relativeTime(at(2025, 9, 2, 9, 0), now)).toBe("Oct 2, 2025");
  });

  it("shows the date for times well in the future", () => {
    expect(relativeTime(at(2026, 9, 12, 9, 0), now)).toBe("Oct 12");
  });

  it("returns an empty string for an invalid date", () => {
    expect(relativeTime(new Date("nope"), now)).toBe("");
  });
});
