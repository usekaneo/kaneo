import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { formatDuration, parseDuration } from "./duration.js";

const seconds = (input: string) => {
  const parsed = parseDuration(input);
  return Result.isSuccess(parsed) ? parsed.success : null;
};

describe("parseDuration", () => {
  it("reads hours, minutes and both", () => {
    expect(seconds("1h30m")).toBe(5400);
    expect(seconds("45m")).toBe(2700);
    expect(seconds("2h")).toBe(7200);
    expect(seconds("1h 30m")).toBe(5400);
    expect(seconds("2H")).toBe(7200);
  });

  it("reads decimal hours and clock times", () => {
    expect(seconds("1.5h")).toBe(5400);
    expect(seconds("0.25h")).toBe(900);
    expect(seconds("1:30")).toBe(5400);
    expect(seconds("0:45")).toBe(2700);
  });

  it("rejects input without a unit or with junk", () => {
    expect(seconds("90")).toBeNull();
    expect(seconds("")).toBeNull();
    expect(seconds("1h30")).toBeNull();
    expect(seconds("abc")).toBeNull();
    expect(seconds("1:75")).toBeNull();
    expect(seconds("-1h")).toBeNull();
  });

  it("rejects durations under a minute or over 31 days", () => {
    expect(seconds("0m")).toBeNull();
    expect(seconds("0.001h")).toBeNull();
    expect(seconds("745h")).toBeNull();
    expect(seconds("744h")).toBe(744 * 3600);
  });

  it("names the flag and gives a hint", () => {
    const parsed = parseDuration("soon", "--duration");
    expect(Result.isFailure(parsed)).toBe(true);
    if (Result.isFailure(parsed)) {
      expect(parsed.failure.message).toBe(
        '--duration "soon" is not a duration.',
      );
      expect(parsed.failure.hint).toContain("1h30m");
    }
  });
});

describe("formatDuration", () => {
  it("prints hours and minutes, dropping empty parts", () => {
    expect(formatDuration(5100)).toBe("1h 25m");
    expect(formatDuration(2700)).toBe("45m");
    expect(formatDuration(7200)).toBe("2h");
    expect(formatDuration(0)).toBe("0m");
  });

  it("rounds down and marks sub-minute time", () => {
    expect(formatDuration(5159)).toBe("1h 25m");
    expect(formatDuration(42)).toBe("<1m");
    expect(formatDuration(-5)).toBe("0m");
  });

  it("keeps long totals in hours", () => {
    expect(formatDuration(30 * 3600 + 60)).toBe("30h 1m");
  });
});
