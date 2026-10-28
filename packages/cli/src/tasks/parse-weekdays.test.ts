import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parseWeekdays } from "./parse-weekdays.js";

const success = <A, E>(result: Result.Result<A, E>) =>
  Result.isSuccess(result) ? result.success : "failed";

describe("parseWeekdays", () => {
  it("reads short and long names from lists and repeated flags", () => {
    expect(success(parseWeekdays(["mon,Thursday", " FRI "]))).toEqual([
      1, 4, 5,
    ]);
    expect(success(parseWeekdays(["sun", "sat", "tues", "thurs"]))).toEqual([
      0, 2, 4, 6,
    ]);
  });

  it("drops duplicates and empty entries", () => {
    expect(success(parseWeekdays(["mon,,monday", "mon,"]))).toEqual([1]);
    expect(success(parseWeekdays([]))).toEqual([]);
  });

  it("names the day it does not know", () => {
    const result = parseWeekdays(["mon,funday"]);
    expect(Result.isFailure(result) && result.failure.message).toBe(
      '--on "funday" is not a weekday.',
    );
  });
});
