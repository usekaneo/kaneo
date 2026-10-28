import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "dropdown",
  "multiselect",
  "boolean",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Readonly<Record<FieldType, string>> = {
  text: "Text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  multiselect: "Multi-select",
  boolean: "Yes or no",
};

const ALIASES: Readonly<Record<string, FieldType>> = {
  select: "dropdown",
  "multi-select": "multiselect",
  multi: "multiselect",
  bool: "boolean",
  checkbox: "boolean",
  string: "text",
};

export function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as ReadonlyArray<string>).includes(value);
}

export function fieldTypeLabel(type: string): string {
  return isFieldType(type) ? FIELD_TYPE_LABELS[type] : type;
}

export function parseFieldType(
  input: string,
): Result.Result<FieldType, InvalidArgument> {
  const value = input.trim().toLowerCase();
  if (isFieldType(value)) return Result.succeed(value);
  const alias = ALIASES[value];
  if (alias) return Result.succeed(alias);
  return Result.fail(
    new InvalidArgument({
      message: `"${input.trim()}" is not a field type.`,
      hint: `Use one of: ${FIELD_TYPES.join(", ")}.`,
    }),
  );
}

export function fieldOptions(raw: unknown): string[] {
  const parsed =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;
  return Array.isArray(parsed)
    ? parsed.filter((option): option is string => typeof option === "string")
    : [];
}

export function checkFieldOptions(
  type: FieldType,
  options: ReadonlyArray<string>,
): Result.Result<ReadonlyArray<string> | undefined, InvalidArgument> {
  const cleaned = [
    ...new Set(options.map((option) => option.trim()).filter(Boolean)),
  ];
  if (type === "dropdown" || type === "multiselect") {
    const needed = type === "dropdown" ? 1 : 2;
    if (cleaned.length < needed) {
      return Result.fail(
        new InvalidArgument({
          message:
            type === "dropdown"
              ? "A dropdown field needs at least one option."
              : "A multi-select field needs at least two options.",
          hint: "Pass each choice with --option, for example --option iOS --option Android.",
        }),
      );
    }
    return Result.succeed(cleaned);
  }
  if (cleaned.length > 0) {
    return Result.fail(
      new InvalidArgument({
        message: `A ${FIELD_TYPE_LABELS[type].toLowerCase()} field has no options.`,
        hint: "--option only applies to dropdown and multiselect fields.",
      }),
    );
  }
  return Result.succeed(undefined);
}
