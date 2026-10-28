import { Result } from "effect";
import type { TaskRecurrence } from "../api/schemas.js";
import { InvalidArgument } from "../errors/errors.js";
import { parseWeekdays } from "./parse-weekdays.js";

export const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

const MAX_INTERVAL = 99;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function buildRecurrence(options: {
  readonly frequency: Frequency;
  readonly every: number;
  readonly on: ReadonlyArray<string>;
  readonly timeZone: string;
}): Result.Result<TaskRecurrence, InvalidArgument> {
  const { frequency, every, timeZone } = options;
  if (!Number.isInteger(every) || every < 1 || every > MAX_INTERVAL) {
    return Result.fail(
      new InvalidArgument({
        message: `--every must be a whole number from 1 to ${MAX_INTERVAL}.`,
        hint: "For example, --every 2 repeats every second week.",
      }),
    );
  }
  if (options.on.length > 0 && frequency !== "weekly") {
    return Result.fail(
      new InvalidArgument({
        message: "--on only applies to weekly rules.",
        hint: "Use weekly --on mon,thu, or leave out --on.",
      }),
    );
  }
  if (!isTimeZone(timeZone)) {
    return Result.fail(
      new InvalidArgument({
        message: `--time-zone "${timeZone}" is not a time zone.`,
        hint: "Use an IANA time zone such as Europe/Madrid.",
      }),
    );
  }
  const weekdays = parseWeekdays(options.on);
  if (Result.isFailure(weekdays)) return Result.fail(weekdays.failure);
  return Result.succeed({
    frequency,
    interval: every,
    ...(weekdays.success.length > 0 ? { weekdays: weekdays.success } : {}),
    timeZone,
  });
}
