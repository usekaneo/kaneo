import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  addDays,
  formatClock,
  formatDay,
  formatDueShort,
  formatLongDate,
  formatDateTime,
  monthName,
  relativeShort,
  relativeLong,
  formatDuration,
  initials,
  parseDay,
  suggestProjectKey,
  ticketId,
  toIsoDay,
} from "./format";
import { i18n } from "./i18n";

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

describe("localized dates and relative times", () => {
  afterEach(async () => {
    vi.useRealTimers();
    await i18n.changeLanguage("en-US");
  });

  it("keeps English calendar and relative labels across local day boundaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 9, 12));
    expect(monthName(2)).toBe("Mar");
    expect(monthName(2, true)).toBe("March");
    expect(formatDay({ y: 2026, m: 2, d: 9 })).toBe("Mar 9");
    expect(formatDay({ y: 2025, m: 2, d: 9 })).toBe("Mar 9, 2025");
    expect(formatLongDate(new Date(2026, 2, 9))).toBe("Monday, March 9");
    expect(formatDateTime(new Date(2026, 2, 9, 12, 30).toISOString())).toBe(
      "Mar 9, 12:30",
    );
    expect(formatDueShort("2026-03-09")).toBe("Today");
    expect(formatDueShort("2026-03-10")).toBe("Tomorrow");
    expect(formatDueShort("2026-03-11")).toBe("Wed, Mar 11");
    expect(relativeShort(new Date(2026, 2, 9, 11, 48).toISOString())).toBe(
      "12m",
    );
    expect(relativeLong(new Date(2026, 2, 9, 9).toISOString())).toBe(
      "3 hr ago",
    );
    expect(relativeShort(new Date(2026, 2, 8, 23).toISOString())).toBe(
      "Yesterday",
    );
    expect(relativeLong(new Date(2026, 2, 8, 23).toISOString())).toBe(
      "Yesterday",
    );
  });

  it("reads the active locale and translations on each call", async () => {
    const date = new Date(2026, 2, 9);
    i18n.addResourceBundle(
      "de-DE",
      "mobile",
      {
        time: { today: "Heute" },
      },
      true,
      true,
    );
    await i18n.changeLanguage("de-DE");
    vi.useFakeTimers();
    vi.setSystemTime(date);
    expect(monthName(2, true)).toBe("März");
    expect(formatDay({ y: 2026, m: 2, d: 9 })).toBe(
      new Intl.DateTimeFormat("de-DE", {
        month: "short",
        day: "numeric",
      }).format(date),
    );
    expect(formatDueShort("2026-03-09")).toBe("Heute");
    i18n.removeResourceBundle("de-DE", "mobile");
  });
});
