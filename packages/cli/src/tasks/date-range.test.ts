import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { checkDateRange } from "./date-range.js";

const at = (day: number, hour: number) =>
  new Date(2026, 9, day, hour).toISOString();

describe("checkDateRange", () => {
  it("accepts missing dates", () => {
    expect(Result.isSuccess(checkDateRange(null, null))).toBe(true);
    expect(Result.isSuccess(checkDateRange(at(9, 12), undefined))).toBe(true);
    expect(Result.isSuccess(checkDateRange(undefined, at(9, 12)))).toBe(true);
  });

  it("accepts a start on or before the due day", () => {
    expect(Result.isSuccess(checkDateRange(at(8, 12), at(9, 12)))).toBe(true);
    expect(Result.isSuccess(checkDateRange(at(9, 23), at(9, 1)))).toBe(true);
  });

  it("rejects a start after the due day", () => {
    const result = checkDateRange(at(10, 0), at(9, 23));
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "The start date is after the due date.",
    );
  });
});
