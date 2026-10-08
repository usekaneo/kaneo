import type {
  ParseSettingsResult,
  SettingsErrors,
  SettingsSchema,
} from "./types.js";
import { defaultValue, isRequired, validateField } from "./validate-field.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSettings(
  schema: SettingsSchema,
  input: unknown,
  previous: Record<string, unknown> = {},
): ParseSettingsResult {
  if (input !== undefined && !isRecord(input)) {
    return { ok: false, errors: { _: "Settings must be an object" } };
  }

  const source = input ?? {};
  const values: Record<string, unknown> = {};
  const errors: SettingsErrors = {};

  for (const [key, field] of Object.entries(schema)) {
    const raw = source[key];
    const kept = previous[key];

    if (
      field.type === "secret" &&
      raw === undefined &&
      typeof kept === "string"
    ) {
      values[key] = kept;
      continue;
    }

    const result = validateField(field, raw);
    if (result.kind === "error") {
      errors[key] = result.message;
      continue;
    }
    if (result.kind === "unset") {
      if (isRequired(field) && defaultValue(field) === undefined) {
        errors[key] = "Required";
      }
      continue;
    }
    values[key] = result.value;
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, values };
}
