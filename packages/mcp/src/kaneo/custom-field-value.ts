export type CustomFieldValueInput = string | number | boolean | string[] | null;

// The API stores every custom field value as a string: multiselect values are
// a JSON array, and an empty string clears the field.
export function encodeCustomFieldValue(value: CustomFieldValueInput): string {
  if (value === null) return "";
  if (Array.isArray(value)) return value.length ? JSON.stringify(value) : "";
  return String(value);
}
