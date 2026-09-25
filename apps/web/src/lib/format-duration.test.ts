import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatDurationExact,
  formatElapsed,
  formatEntryRange,
  parseDurationString,
} from "./format";

describe("formatDuration", () => {
  it("shows seconds under a minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(42)).toBe("42s");
  });

  it("shows minutes under an hour", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(24 * 60 + 30)).toBe("24m");
  });

  it("shows hours with remaining minutes", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3600 + 24 * 60)).toBe("1h 24m");
  });

  it("clamps negative input", () => {
    expect(formatDuration(-5)).toBe("0s");
  });
});

describe("formatDurationExact", () => {
  it("formats h:mm:ss", () => {
    expect(formatDurationExact(0)).toBe("0:00:00");
    expect(formatDurationExact(42)).toBe("0:00:42");
    expect(formatDurationExact(3600 + 24 * 60 + 7)).toBe("1:24:07");
  });
});

describe("parseDurationString", () => {
  it("parses hours, minutes, and seconds in any order", () => {
    expect(parseDurationString("1h 30m 5s")).toBe(3600 + 1800 + 5);
    expect(parseDurationString("30m 1h")).toBe(5400);
    expect(parseDurationString("1h30m")).toBe(5400);
  });

  it("treats a bare number as minutes", () => {
    expect(parseDurationString("90")).toBe(5400);
  });

  it("rejects day units, empty input, and trailing garbage", () => {
    expect(parseDurationString("1d")).toBeNull();
    expect(parseDurationString("1d 1h")).toBeNull();
    expect(parseDurationString("")).toBeNull();
    expect(parseDurationString("abc")).toBeNull();
    expect(parseDurationString("1h xyz")).toBeNull();
  });
});

describe("formatEntryRange", () => {
  it("renders date, range, and zone", () => {
    const label = formatEntryRange(
      new Date("2026-09-19T13:44:00Z"),
      new Date("2026-09-19T14:44:00Z"),
      "en-US",
    );
    expect(label).toMatch(/Sep 19/);
    expect(label).toContain(" - ");
  });
});

describe("formatElapsed", () => {
  it("formats mm:ss under an hour", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(90)).toBe("01:30");
  });

  it("switches to h:mm:ss past an hour", () => {
    expect(formatElapsed(3600 + 5)).toBe("1:00:05");
  });
});
