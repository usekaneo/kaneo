import { checkSettingChoices } from "./check-setting-choices.js";
import { checkSettingRange } from "./check-setting-range.js";
import { isRecord } from "./is-record.js";
import type { SettingField } from "./types.js";

type ValueKind = "text" | "number" | "boolean";

const PROPERTIES: Readonly<
  Record<SettingField["type"], Readonly<Record<string, ValueKind>>>
> = {
  text: {
    placeholder: "text",
    multiline: "boolean",
    required: "boolean",
    default: "text",
  },
  secret: { placeholder: "text", required: "boolean" },
  number: {
    min: "number",
    max: "number",
    step: "number",
    required: "boolean",
    default: "number",
  },
  boolean: { default: "boolean" },
  select: { required: "boolean" },
  multiselect: {},
};

const ACCEPTS: Readonly<Record<ValueKind, (value: unknown) => boolean>> = {
  text: (value) => typeof value === "string",
  number: (value) => typeof value === "number" && Number.isFinite(value),
  boolean: (value) => typeof value === "boolean",
};

const EXPECTED: Readonly<Record<ValueKind, string>> = {
  text: "text",
  number: "a number",
  boolean: "true or false",
};

function isFieldType(value: string): value is SettingField["type"] {
  return Object.hasOwn(PROPERTIES, value);
}

export function checkSettingField(key: string, field: unknown): string[] {
  const name = `Setting "${key}"`;
  if (!isRecord(field)) return [`${name} must be an object`];
  const { type } = field;
  if (typeof type !== "string") return [`${name} needs a type`];
  if (!isFieldType(type)) return [`${name} has an unknown type "${type}"`];

  const problems: string[] = [];
  if (typeof field.label !== "string") problems.push(`${name} needs a label`);

  const properties = { description: "text" as const, ...PROPERTIES[type] };
  for (const [property, kind] of Object.entries(properties)) {
    const value = field[property];
    if (value !== undefined && !ACCEPTS[kind](value)) {
      problems.push(`${name} ${property} must be ${EXPECTED[kind]}`);
    }
  }

  if (type === "number") problems.push(...checkSettingRange(name, field));
  if (type === "select" || type === "multiselect") {
    problems.push(...checkSettingChoices(name, type, field));
  }
  return problems;
}
