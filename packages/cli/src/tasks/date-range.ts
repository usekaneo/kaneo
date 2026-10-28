import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

function localDay(value: string): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getFullYear() * 10_000 + date.getMonth() * 100 + date.getDate();
}

export function checkDateRange(
  start: string | null | undefined,
  due: string | null | undefined,
): Result.Result<void, InvalidArgument> {
  const startDay = start ? localDay(start) : null;
  const dueDay = due ? localDay(due) : null;
  if (startDay !== null && dueDay !== null && startDay > dueDay) {
    return Result.fail(
      new InvalidArgument({
        message: "The start date is after the due date.",
        hint: "Pick a start date on or before the due date, or move the due date with --due.",
      }),
    );
  }
  return Result.succeed(undefined);
}
