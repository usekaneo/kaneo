import { describe, expect, it } from "vite-plus/test";
import { COMPACT_SPAN, FULL_SPAN, habitDays, monthSpans } from "./habit-days";

describe("habitDays", () => {
  it("spans the last 20 days, today, and the next 3", () => {
    const days = habitDays(new Date(2026, 9, 24));
    expect(days).toHaveLength(FULL_SPAN.before + 1 + FULL_SPAN.after);
    expect(days[0]?.date).toBe("2026-10-04");
    expect(days.find((day) => day.isToday)?.date).toBe("2026-10-24");
    expect(days.filter((day) => day.isFuture).map((day) => day.date)).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
    ]);
  });

  it("ends at today in the compact span", () => {
    const days = habitDays(new Date(2026, 9, 24), COMPACT_SPAN);
    expect(days.map((day) => day.date)).toEqual([
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
    expect(days.some((day) => day.isFuture)).toBe(false);
  });

  it("groups the header by month", () => {
    const spans = monthSpans(habitDays(new Date(2026, 10, 5)));
    expect(spans.map((span) => [span.month.getMonth(), span.days])).toEqual([
      [9, 16],
      [10, 8],
    ]);
  });
});
