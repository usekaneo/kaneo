import { describe, expect, it } from "vite-plus/test";
import {
  addDays,
  formatClock,
  formatDuration,
  initials,
  parseDay,
  suggestProjectKey,
  ticketId,
  toIsoDay,
} from "./format";

describe("parseDay", () => {
  it("reads a bare date as that calendar day", () => {
    expect(parseDay("2026-03-09")).toEqual({ y: 2026, m: 2, d: 9 });
  });

  it("returns null for empty values", () => {
    expect(parseDay(null)).toBeNull();
    expect(parseDay("")).toBeNull();
  });
});

describe("addDays", () => {
  it("rolls over month and year boundaries", () => {
    expect(addDays({ y: 2026, m: 11, d: 31 }, 1)).toEqual({
      y: 2027,
      m: 0,
      d: 1,
    });
  });
});

describe("toIsoDay", () => {
  it("pads month and day", () => {
    expect(toIsoDay({ y: 2026, m: 0, d: 5 })).toBe("2026-01-05");
  });
});

describe("durations", () => {
  it("formats the largest useful units", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(5 * 60)).toBe("5m");
    expect(formatDuration(2 * 3600)).toBe("2h");
    expect(formatDuration(2 * 3600 + 15 * 60)).toBe("2h 15m");
  });

  it("formats a running timer as a clock", () => {
    expect(formatClock(3661)).toBe("01:01:01");
    expect(formatClock(-5)).toBe("00:00:00");
  });
});

describe("ticketId", () => {
  it("prefixes the project key", () => {
    expect(ticketId("kan", 12)).toBe("KAN-12");
    expect(ticketId(null, 12)).toBe("#12");
    expect(ticketId("kan", null)).toBe("");
  });
});

describe("suggestProjectKey", () => {
  it("uses initials for multi-word names and a prefix otherwise", () => {
    expect(suggestProjectKey("Mobile App Launch")).toBe("MAL");
    expect(suggestProjectKey("kaneo")).toBe("KAN");
    expect(suggestProjectKey("  ")).toBe("PRJ");
  });
});

describe("initials", () => {
  it("takes the first and last name", () => {
    expect(initials("Ada Byron Lovelace")).toBe("AL");
    expect(initials("ada")).toBe("AD");
    expect(initials(undefined)).toBe("?");
  });
});
