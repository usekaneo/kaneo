import { describe, expect, it } from "vite-plus/test";
import { DAYS_AFTER, DAYS_BEFORE, habitDays, monthSpans } from "./habit-days";

describe("habitDays", () => {
  it("spans the last 20 days, today, and the next 3", () => {
    const days = habitDays(new Date(2026, 9, 24));
    expect(days).toHaveLength(DAYS_BEFORE + 1 + DAYS_AFTER);
    expect(days[0]?.date).toBe("2026-10-04");
    expect(days.find((day) => day.isToday)?.date).toBe("2026-10-24");
    expect(days.filter((day) => day.isFuture).map((day) => day.date)).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
    ]);
  });

  it("groups the header by month", () => {
    const spans = monthSpans(habitDays(new Date(2026, 10, 5)));
    expect(spans.map((span) => [span.month.getMonth(), span.days])).toEqual([
      [9, 16],
      [10, 8],
    ]);
  });
});
