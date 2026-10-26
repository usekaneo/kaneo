import { describe, expect, it } from "vite-plus/test";
import { upcomingOccurrences } from "./next-occurrence-date";

const iso = (dates: Date[]) => dates.map((date) => date.toISOString());

describe("upcomingOccurrences", () => {
  it("lists the next dates of a rule", () => {
    expect(
      iso(
        upcomingOccurrences(
          new Date("2026-01-31T00:00:00.000Z"),
          { frequency: "monthly", interval: 1, timeZone: "UTC" },
          2,
        ),
      ),
    ).toEqual(["2026-02-28T00:00:00.000Z", "2026-03-28T00:00:00.000Z"]);
  });

  it("follows the selected weekdays and skips weeks by the interval", () => {
    // 2026-10-05 is a Monday.
    expect(
      iso(
        upcomingOccurrences(
          new Date("2026-10-05T00:00:00.000Z"),
          {
            frequency: "weekly",
            interval: 2,
            timeZone: "UTC",
            weekdays: [1, 5],
          },
          3,
        ),
      ),
    ).toEqual([
      "2026-10-09T00:00:00.000Z",
      "2026-10-19T00:00:00.000Z",
      "2026-10-23T00:00:00.000Z",
    ]);
  });
});
