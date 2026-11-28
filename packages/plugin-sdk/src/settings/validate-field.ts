import type { SettingField } from "./types.js";

export type FieldResult =
  | { kind: "value"; value: unknown }
  | { kind: "unset" }
  | { kind: "error"; message: string };

const value = (input: unknown): FieldResult => ({
  kind: "value",
  value: input,
});
const error = (message: string): FieldResult => ({ kind: "error", message });

export function validateField(field: SettingField, raw: unknown): FieldResult {
  if (raw === undefined || raw === null) return { kind: "unset" };

  switch (field.type) {
    case "text":
    case "secret":
      if (typeof raw !== "string") return error("Must be text");
      return raw.trim() === "" ? { kind: "unset" } : value(raw);
    case "number":
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return error("Must be a number");
      }
      if (field.min !== undefined && raw < field.min) {
        return error(`Must be at least ${field.min}`);
      }
      if (field.max !== undefined && raw > field.max) {
        return error(`Must be at most ${field.max}`);
      }
      return value(raw);
    case "boolean":
      return typeof raw === "boolean" ? value(raw) : error("Must be on or off");
    case "select":
      return typeof raw === "string" &&
        field.options.some((option) => option.value === raw)
        ? value(raw)
        : error("Choose one of the listed options");
    case "multiselect": {
      if (!Array.isArray(raw)) return error("Must be a list");
      const allowed = new Set(field.options.map((option) => option.value));
      if (!raw.every((item) => typeof item === "string" && allowed.has(item))) {
        return error("Choose from the listed options");
      }
      return value([...new Set(raw as string[])]);
    }
  }
}

export function defaultValue(field: SettingField): unknown {
  switch (field.type) {
    case "boolean":
      return field.default ?? false;
    case "multiselect":
      return [...(field.default ?? [])];
    case "secret":
      return undefined;
    default:
      return field.default;
  }
}

export function isRequired(field: SettingField): boolean {
  return "required" in field && field.required === true;
}
