import type {
  PublicSettings,
  SettingsSchema,
  SettingsValues,
} from "./types.js";
import { defaultValue, validateField } from "./validate-field.js";

export function readSettings<S extends SettingsSchema>(
  schema: S,
  stored: unknown,
): SettingsValues<S> {
  const source =
    typeof stored === "object" && stored !== null && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};
  const values: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema)) {
    const result = validateField(field, source[key]);
    const resolved =
      result.kind === "value" ? result.value : defaultValue(field);
    if (resolved !== undefined) values[key] = resolved;
  }

  return values as SettingsValues<S>;
}

export function toPublicSettings(
  schema: SettingsSchema,
  stored: unknown,
): PublicSettings {
  const all = readSettings(schema, stored) as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  const configuredSecrets: string[] = [];

  for (const [key, field] of Object.entries(schema)) {
    if (field.type === "secret") {
      if (all[key] !== undefined) configuredSecrets.push(key);
      continue;
    }
    if (all[key] !== undefined) values[key] = all[key];
  }

  return { values, configuredSecrets };
}
