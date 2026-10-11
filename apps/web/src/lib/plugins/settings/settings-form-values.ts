import {
  readSettings,
  type SettingField,
  type SettingsSchema,
} from "@kaneo/plugin-sdk";

export type SecretFormValue =
  | { mode: "keep" }
  | { mode: "replace"; value: string }
  | { mode: "clear" };

export type SettingFormValue = string | boolean | string[] | SecretFormValue;

export type SettingsFormValues = Record<string, SettingFormValue>;

export function isSecretFormValue(value: unknown): value is SecretFormValue {
  return typeof value === "object" && value !== null && "mode" in value;
}

function toFormValue(
  field: SettingField,
  value: unknown,
  configured: boolean,
): SettingFormValue {
  switch (field.type) {
    case "secret":
      return configured ? { mode: "keep" } : { mode: "replace", value: "" };
    case "boolean":
      return value === true;
    case "multiselect":
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
    case "number":
      return typeof value === "number" ? String(value) : "";
    default:
      return typeof value === "string" ? value : "";
  }
}

export function toFormValues(
  schema: SettingsSchema,
  settings: Record<string, unknown>,
  configuredSecrets: readonly string[],
): SettingsFormValues {
  const current = readSettings(schema, settings) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(schema).map(([key, field]) => [
      key,
      toFormValue(field, current[key], configuredSecrets.includes(key)),
    ]),
  );
}

function toPayloadValue(field: SettingField, value: unknown): unknown {
  switch (field.type) {
    case "secret":
      if (!isSecretFormValue(value) || value.mode === "keep") return undefined;
      if (value.mode === "clear") return null;
      return value.value.trim() === "" ? undefined : value.value;
    case "boolean":
      return value === true;
    case "multiselect":
      return Array.isArray(value) ? value : [];
    case "number": {
      const text = typeof value === "string" ? value.trim() : "";
      if (text === "") return null;
      const number = Number(text);
      return Number.isFinite(number) ? number : text;
    }
    default:
      return typeof value === "string" && value !== "" ? value : null;
  }
}

export function toSettingsPayload(
  schema: SettingsSchema,
  values: SettingsFormValues,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) {
    const value = toPayloadValue(field, values[key]);
    if (value !== undefined) payload[key] = value;
  }
  return payload;
}

export function hasSettingsChanges(
  schema: SettingsSchema,
  initial: SettingsFormValues,
  current: SettingsFormValues,
): boolean {
  return (
    JSON.stringify(toSettingsPayload(schema, initial)) !==
    JSON.stringify(toSettingsPayload(schema, current))
  );
}
