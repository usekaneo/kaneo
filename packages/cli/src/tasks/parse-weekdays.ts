import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

// The API numbers weekdays 0 for Sunday to 6 for Saturday.
const WEEKDAYS: ReadonlyArray<ReadonlyArray<string>> = [
  ["sun", "sunday"],
  ["mon", "monday"],
  ["tue", "tues", "tuesday"],
  ["wed", "wednesday"],
  ["thu", "thur", "thurs", "thursday"],
  ["fri", "friday"],
  ["sat", "saturday"],
];

// Takes repeated flags and comma-separated lists alike: --on mon,thu --on fri.
export function parseWeekdays(
  inputs: ReadonlyArray<string>,
): Result.Result<ReadonlyArray<number>, InvalidArgument> {
  const days = new Set<number>();
  for (const name of inputs.flatMap((input) => input.split(","))) {
    const normalized = name.trim().toLowerCase();
    if (normalized === "") continue;
    const day = WEEKDAYS.findIndex((names) => names.includes(normalized));
    if (day === -1) {
      return Result.fail(
        new InvalidArgument({
          message: `--on "${name.trim()}" is not a weekday.`,
          hint: "Use day names such as mon,thu or monday.",
        }),
      );
    }
    days.add(day);
  }
  return Result.succeed([...days].sort((a, b) => a - b));
}
