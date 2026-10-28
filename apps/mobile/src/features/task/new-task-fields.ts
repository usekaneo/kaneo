import type { CustomFieldDefinition } from "@/lib/api/types";

type Field = Pick<
  CustomFieldDefinition,
  "id" | "type" | "required" | "defaultValue"
>;

/** Same rule as the API's `isCustomFieldValueEmpty`: blank, or an empty multiselect array. */
export function isFieldValueEmpty(
  value: string | null | undefined,
  type: string,
) {
  if (!value?.trim()) return true;
  if (type !== "multiselect") return false;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length === 0;
  } catch {
    return false;
  }
}

/**
 * The values a new task would get: the person's edits, else each field's default (the API
 * applies required defaults anyway, and the web form seeds them all). An untouched required
 * switch saves as off, which is what it shows.
 */
export function draftFieldValues(
  fields: Field[],
  edits: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of fields) {
    const value =
      edits[f.id] ??
      (isFieldValueEmpty(f.defaultValue, f.type)
        ? undefined
        : f.defaultValue) ??
      (f.required && f.type === "boolean" ? "false" : undefined);
    if (value != null) values[f.id] = value;
  }
  return values;
}

export function hasMissingRequired(
  fields: Field[],
  values: Record<string, string>,
) {
  return fields.some(
    (f) => f.required && isFieldValueEmpty(values[f.id], f.type),
  );
}

export function customFieldsPayload(
  fields: Field[],
  values: Record<string, string>,
) {
  return fields
    .filter((f) => !isFieldValueEmpty(values[f.id], f.type))
    .map((f) => ({ fieldId: f.id, value: values[f.id]! }));
}
