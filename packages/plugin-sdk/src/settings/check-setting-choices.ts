import { isRecord } from "./is-record.js";

type ChoiceType = "select" | "multiselect";

function isOption(value: unknown): value is { value: string; label: string } {
  return (
    isRecord(value) &&
    typeof value.value === "string" &&
    typeof value.label === "string"
  );
}

function defaultChoices(type: ChoiceType, fallback: unknown): string[] | null {
  if (type === "select") {
    return typeof fallback === "string" ? [fallback] : null;
  }
  return Array.isArray(fallback) &&
    fallback.every((item) => typeof item === "string")
    ? fallback
    : null;
}

export function checkSettingChoices(
  name: string,
  type: ChoiceType,
  field: Record<string, unknown>,
): string[] {
  const { options } = field;
  if (!Array.isArray(options)) return [`${name} is a ${type} without options`];

  const broken = options.flatMap((option: unknown, index) =>
    isOption(option)
      ? []
      : [`${name} option ${index + 1} needs a text value and label`],
  );
  if (broken.length > 0 || field.default === undefined) return broken;

  const chosen = defaultChoices(type, field.default);
  if (!chosen) {
    return [
      `${name} default must be ${type === "select" ? "an option value" : "a list of option values"}`,
    ];
  }
  const values = new Set(
    options.map((option: { value: string }) => option.value),
  );
  return chosen
    .filter((choice) => !values.has(choice))
    .map((choice) => `${name} default "${choice}" is not one of its options`);
}
