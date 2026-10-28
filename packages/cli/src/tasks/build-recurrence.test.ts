import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { buildRecurrence } from "./build-recurrence.js";

const rule = {
  frequency: "weekly",
  every: 1,
  on: [],
  timeZone: "Europe/Madrid",
} as const;

const failure = <A, E extends { message: string }>(
  result: Result.Result<A, E>,
) => (Result.isFailure(result) ? result.failure.message : "succeeded");

describe("buildRecurrence", () => {
  it("builds the rule the API takes", () => {
    expect(buildRecurrence(rule)).toEqual(
      Result.succeed({
        frequency: "weekly",
        interval: 1,
        timeZone: "Europe/Madrid",
      }),
    );
    expect(buildRecurrence({ ...rule, every: 2, on: ["thu,mon"] })).toEqual(
      Result.succeed({
        frequency: "weekly",
        interval: 2,
        weekdays: [1, 4],
        timeZone: "Europe/Madrid",
      }),
    );
  });

  it("keeps the interval between 1 and 99", () => {
    for (const every of [0, 100, -1]) {
      expect(failure(buildRecurrence({ ...rule, every }))).toBe(
        "--every must be a whole number from 1 to 99.",
      );
    }
    expect(Result.isSuccess(buildRecurrence({ ...rule, every: 99 }))).toBe(
      true,
    );
  });

  it("only takes weekdays on weekly rules", () => {
    expect(
      failure(buildRecurrence({ ...rule, frequency: "monthly", on: ["mon"] })),
    ).toBe("--on only applies to weekly rules.");
  });

  it("rejects unknown time zones and weekdays", () => {
    expect(
      failure(buildRecurrence({ ...rule, timeZone: "Mars/Olympus" })),
    ).toBe('--time-zone "Mars/Olympus" is not a time zone.');
    expect(failure(buildRecurrence({ ...rule, on: ["someday"] }))).toBe(
      '--on "someday" is not a weekday.',
    );
  });
});
