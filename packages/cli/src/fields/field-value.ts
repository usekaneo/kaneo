import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { parseDateInput } from "../tasks/parse-date.js";

export type FieldDefinition = {
  readonly name: string;
  readonly type: string;
  readonly options: ReadonlyArray<string>;
};

export type FieldJsonValue = string | number | boolean | string[] | null;

const TRUE_WORDS = new Set(["true", "yes", "y", "on", "1"]);
const FALSE_WORDS = new Set(["false", "no", "n", "off", "0"]);

function invalid(field: FieldDefinition, message: string, hint: string) {
  return Result.fail(
    new InvalidArgument({ message: `${field.name}: ${message}`, hint }),
  );
}

function localDay(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function matchOption(
  options: ReadonlyArray<string>,
  input: string,
): string | undefined {
  const wanted = input.trim();
  return (
    options.find((option) => option === wanted) ??
    options.find((option) => option.toLowerCase() === wanted.toLowerCase())
  );
}

export function parseFieldValue(
  field: FieldDefinition,
  input: string,
  now: Date,
): Result.Result<string, InvalidArgument> {
  const value = input.trim();
  if (value === "") {
    return invalid(
      field,
      "the value is empty.",
      "Pass a value, or --clear to remove it.",
    );
  }
  switch (field.type) {
    case "number":
      return Number.isFinite(Number(value))
        ? Result.succeed(value)
        : invalid(
            field,
            `"${value}" is not a number.`,
            "Use a number such as 3 or 2.5.",
          );
    case "boolean": {
      const word = value.toLowerCase();
      if (TRUE_WORDS.has(word)) return Result.succeed("true");
      if (FALSE_WORDS.has(word)) return Result.succeed("false");
      return invalid(
        field,
        `"${value}" is not yes or no.`,
        "Use true or false (or yes or no).",
      );
    }
    case "date": {
      const parsed = parseDateInput(value, now, field.name);
      return Result.isSuccess(parsed)
        ? Result.succeed(localDay(parsed.success))
        : invalid(
            field,
            `"${value}" is not a date.`,
            "Use YYYY-MM-DD, today, tomorrow, or +3d.",
          );
    }
    case "dropdown": {
      const option = matchOption(field.options, value);
      return option
        ? Result.succeed(option)
        : invalid(
            field,
            `"${value}" is not one of the options.`,
            `Use one of: ${field.options.join(", ")}.`,
          );
    }
    case "multiselect": {
      const parts = value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const unknown = parts.filter((part) => !matchOption(field.options, part));
      if (unknown.length > 0 || parts.length === 0) {
        return invalid(
          field,
          unknown.length > 0
            ? `not an option: ${unknown.join(", ")}.`
            : "pick at least one option.",
          `Separate choices with commas. Options: ${field.options.join(", ")}.`,
        );
      }
      const chosen = [
        ...new Set(
          parts.map((part) => matchOption(field.options, part) ?? part),
        ),
      ];
      return Result.succeed(JSON.stringify(chosen));
    }
    default:
      return Result.succeed(value);
  }
}

export function isEmptyFieldValue(raw: string | null): boolean {
  if (raw === null || raw.trim() === "") return true;
  return raw.trim() === "[]";
}

export function fieldValueJson(
  type: string,
  raw: string | null,
): FieldJsonValue {
  if (raw === null || isEmptyFieldValue(raw)) return null;
  if (type === "number") {
    const number = Number(raw);
    return Number.isFinite(number) ? number : raw;
  }
  if (type === "boolean") return raw === "true";
  if (type === "multiselect") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [raw];
    } catch {
      return [raw];
    }
  }
  return raw;
}

export function formatJsonValue(value: FieldJsonValue): string | null {
  if (value === null) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function formatFieldValue(
  type: string,
  raw: string | null,
): string | null {
  return formatJsonValue(fieldValueJson(type, raw));
}
