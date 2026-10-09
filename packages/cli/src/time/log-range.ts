import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/u;
const WORKDAY_START_HOUR = 9;

export type LogRange = {
  readonly startTime: string;
  readonly endTime: string;
};

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function parseDay(value: string, now: Date): Date | null {
  if (value === "today") return now;
  if (value === "yesterday") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }
  const iso = ISO_DAY.exec(value);
  if (!iso) return null;
  const year = Number(iso[1]);
  const month = Number(iso[2]) - 1;
  const day = Number(iso[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function logRange(
  seconds: number,
  dayInput: string,
  now: Date,
): Result.Result<LogRange, InvalidArgument> {
  const day = parseDay(dayInput.trim().toLowerCase(), now);
  if (!day) {
    return Result.fail(
      new InvalidArgument({
        message: `--date "${dayInput}" is not a date.`,
        hint: "Use today, yesterday, or YYYY-MM-DD.",
      }),
    );
  }
  if (sameDay(day, now)) {
    return Result.succeed({
      startTime: new Date(now.getTime() - seconds * 1000).toISOString(),
      endTime: now.toISOString(),
    });
  }
  if (day.getTime() > now.getTime()) {
    return Result.fail(
      new InvalidArgument({
        message: `--date ${dayInput} is in the future.`,
        hint: "Log time for today or an earlier day.",
      }),
    );
  }
  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    WORKDAY_START_HOUR,
  );
  return Result.succeed({
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + seconds * 1000).toISOString(),
  });
}
