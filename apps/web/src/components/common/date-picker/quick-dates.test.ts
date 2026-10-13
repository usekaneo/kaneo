import { describe, expect, it } from "vite-plus/test";
import { getQuickDates } from "./quick-dates";

const ids = (now: Date) => getQuickDates(now, 1).map((item) => item.id);

describe("getQuickDates", () => {
  it("offers every pick midweek", () => {
    expect(getQuickDates(new Date(2026, 9, 13, 9), 1)).toEqual([
      { id: "today", date: new Date(2026, 9, 13) },
      { id: "tomorrow", date: new Date(2026, 9, 14) },
      { id: "weekend", date: new Date(2026, 9, 17) },
      { id: "next-week", date: new Date(2026, 9, 19) },
    ]);
  });

  it("drops picks that land on an earlier one", () => {
    expect(ids(new Date(2026, 9, 16))).toEqual([
      "today",
      "tomorrow",
      "next-week",
    ]);
    expect(ids(new Date(2026, 9, 18))).toEqual(["today", "tomorrow"]);
  });

  it("starts next week on the preferred day", () => {
    const sunday = getQuickDates(new Date(2026, 9, 13), 0).at(-1);
    expect(sunday?.date).toEqual(new Date(2026, 9, 18));
  });
});
