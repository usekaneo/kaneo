import { describe, expect, it } from "vite-plus/test";
import { formatRecurrence } from "./format-recurrence.js";

describe("formatRecurrence", () => {
  it("names single steps after the pattern", () => {
    expect(formatRecurrence({ frequency: "daily", interval: 1 })).toBe("Daily");
    expect(formatRecurrence({ frequency: "yearly", interval: 1 })).toBe(
      "Yearly",
    );
  });

  it("counts longer intervals", () => {
    expect(formatRecurrence({ frequency: "monthly", interval: 3 })).toBe(
      "Every 3 months",
    );
  });

  it("lists weekly days from Monday, with Sunday last", () => {
    expect(
      formatRecurrence({
        frequency: "weekly",
        interval: 1,
        weekdays: [4, 0, 1],
      }),
    ).toBe("Weekly on Monday, Thursday and Sunday");
    expect(
      formatRecurrence({ frequency: "weekly", interval: 2, weekdays: [5] }),
    ).toBe("Every 2 weeks on Friday");
  });
});
