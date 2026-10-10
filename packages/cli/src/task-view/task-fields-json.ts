import { fieldValueJson } from "../fields/field-value.js";
import type { TaskFieldJson } from "../fields/render-task-fields.js";
import type { TaskFieldValue } from "./task-field-values.js";

export function toTaskFieldsJson(
  values: ReadonlyArray<TaskFieldValue>,
): TaskFieldJson[] {
  return [...values]
    .sort(
      (a, b) =>
        a.fieldPosition - b.fieldPosition ||
        a.fieldName.localeCompare(b.fieldName),
    )
    .map((value) => ({
      id: value.fieldId,
      name: value.fieldName,
      type: value.fieldType,
      value: fieldValueJson(value.fieldType, value.value),
    }))
    .filter((field) => field.value !== null);
}
