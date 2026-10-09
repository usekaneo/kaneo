import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { logRange } from "./log-range.js";

const now = new Date(2026, 9, 8, 15, 30, 0);

const range = (seconds: number, day: string) => {
  const result = logRange(seconds, day, now);
  return Result.isSuccess(result) ? result.success : null;
};

describe("logRange", () => {
  it("ends today's entries now", () => {
    expect(range(5400, "today")).toEqual({
      startTime: new Date(2026, 9, 8, 14, 0, 0).toISOString(),
      endTime: now.toISOString(),
    });
    expect(range(5400, "2026-10-08")).toEqual(range(5400, "today"));
  });

  it("starts earlier days at 9:00 local time", () => {
    expect(range(2700, "yesterday")).toEqual({
      startTime: new Date(2026, 9, 7, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 9, 7, 9, 45, 0).toISOString(),
    });
    expect(range(3600, "2026-09-30")).toEqual({
      startTime: new Date(2026, 8, 30, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 8, 30, 10, 0, 0).toISOString(),
    });
  });

  it("rejects future days and impossible dates", () => {
    expect(range(3600, "2026-10-09")).toBeNull();
    expect(range(3600, "2026-02-31")).toBeNull();
    expect(range(3600, "last week")).toBeNull();
  });

  it("explains a bad date", () => {
    const result = logRange(3600, "someday", now);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.hint).toBe("Use today, yesterday, or YYYY-MM-DD.");
    }
  });
});
