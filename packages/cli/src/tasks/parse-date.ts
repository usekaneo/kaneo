import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/u;
const RELATIVE_DAYS = /^\+(\d{1,4})d$/u;

function localNoon(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function invalid(
  input: string,
  flag: string,
  allowNone: boolean,
): InvalidArgument {
  return new InvalidArgument({
    message: `${flag} "${input}" is not a date.`,
    hint: allowNone
      ? "Use YYYY-MM-DD, today, tomorrow, +3d, or none to clear it."
      : "Use YYYY-MM-DD, today, tomorrow, or +3d.",
  });
}

function parseDay(value: string, now: Date): Date | null {
  if (value === "today")
    return localNoon(now.getFullYear(), now.getMonth(), now.getDate());
  if (value === "tomorrow") {
    return localNoon(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }
  const relative = RELATIVE_DAYS.exec(value);
  if (relative) {
    return localNoon(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + Number(relative[1]),
    );
  }
  const iso = ISO_DAY.exec(value);
  if (!iso) return null;
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  const date = localNoon(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function parseDateInput(
  input: string,
  now: Date,
  flag = "--due",
): Result.Result<string, InvalidArgument> {
  const date = parseDay(input.trim().toLowerCase(), now);
  return date
    ? Result.succeed(date.toISOString())
    : Result.fail(invalid(input, flag, false));
}

export function parseDateChange(
  input: string,
  now: Date,
  flag = "--due",
): Result.Result<string | null, InvalidArgument> {
  const value = input.trim().toLowerCase();
  if (value === "none") return Result.succeed(null);
  const date = parseDay(value, now);
  return date
    ? Result.succeed(date.toISOString())
    : Result.fail(invalid(input, flag, true));
}
