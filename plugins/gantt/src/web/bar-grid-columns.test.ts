import { parseISO } from "date-fns";
import { describe, expect, it } from "vite-plus/test";
import { getBarGridColumns } from "./bar-grid-columns.js";

const rangeStart = parseISO("2026-09-01");

describe("getBarGridColumns", () => {
  it("places a bar on the grid lines of its days", () => {
    expect(
      getBarGridColumns(
        parseISO("2026-09-03"),
        parseISO("2026-09-05"),
        rangeStart,
        91,
      ),
    ).toEqual({ barInView: true, lineStart: 3, lineEnd: 6 });
  });

  it("clips a bar that starts before and ends after the window", () => {
    expect(
      getBarGridColumns(
        parseISO("2026-08-01"),
        parseISO("2027-01-01"),
        rangeStart,
        10,
      ),
    ).toEqual({ barInView: true, lineStart: 1, lineEnd: 11 });
  });

  it("hides bars outside the window", () => {
    expect(
      getBarGridColumns(
        parseISO("2026-08-01"),
        parseISO("2026-08-31"),
        rangeStart,
        91,
      ).barInView,
    ).toBe(false);
    expect(
      getBarGridColumns(
        parseISO("2026-12-01"),
        parseISO("2026-12-02"),
        rangeStart,
        91,
      ).barInView,
    ).toBe(false);
  });
});
