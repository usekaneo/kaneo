import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

const UNITS = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?$/u;
const CLOCK = /^(\d+):([0-5]\d)$/u;
const MAX_SECONDS = 24 * 60 * 60 * 31;

function invalid(input: string, flag: string): InvalidArgument {
  return new InvalidArgument({
    message: `${flag} "${input}" is not a duration.`,
    hint: "Use hours and minutes, for example 1h30m, 45m, 2h, 1.5h or 1:30.",
  });
}

function toSeconds(input: string): number | null {
  const value = input.trim().toLowerCase().replace(/\s+/gu, "");
  const clock = CLOCK.exec(value);
  if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60;
  const units = UNITS.exec(value);
  if (!units || (units[1] === undefined && units[2] === undefined)) {
    return null;
  }
  const hours = Number(units[1] ?? 0);
  const minutes = Number(units[2] ?? 0);
  return Math.round(hours * 3600 + minutes * 60);
}

export function parseDuration(
  input: string,
  flag = "Duration",
): Result.Result<number, InvalidArgument> {
  const seconds = toSeconds(input);
  if (seconds === null) return Result.fail(invalid(input, flag));
  if (seconds < 60) {
    return Result.fail(
      new InvalidArgument({
        message: `${flag} "${input}" is shorter than a minute.`,
        hint: "Log at least 1m.",
      }),
    );
  }
  if (seconds > MAX_SECONDS) {
    return Result.fail(
      new InvalidArgument({
        message: `${flag} "${input}" is longer than 31 days.`,
        hint: "Split it into several entries.",
      }),
    );
  }
  return Result.succeed(seconds);
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds > 0 && seconds < 60) return "<1m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
