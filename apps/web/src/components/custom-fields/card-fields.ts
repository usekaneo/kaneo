import type { CustomFieldType } from "@/components/project/custom-fields/types";
import type { CustomFieldValue } from "@/hooks/queries/custom-field/use-get-custom-field-values-by-project";
import { isCustomFieldValueEmpty } from "./missing-required-fields";

export type CardField = {
  fieldId: string;
  name: string;
  type: CustomFieldType;
  value: string;
};

const groupedByTask = new WeakMap<
  CustomFieldValue[],
  Map<string, CustomFieldValue[]>
>();

function valuesByTask(values: CustomFieldValue[]) {
  const cached = groupedByTask.get(values);
  if (cached) return cached;
  const grouped = new Map<string, CustomFieldValue[]>();
  for (const value of values) {
    const list = grouped.get(value.taskId);
    if (list) list.push(value);
    else grouped.set(value.taskId, [value]);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.fieldPosition - b.fieldPosition);
  }
  groupedByTask.set(values, grouped);
  return grouped;
}

export function cardFieldsForTask(
  values: CustomFieldValue[] | undefined,
  taskId: string,
  hiddenFieldIds: string[],
): CardField[] {
  if (!values) return [];
  return (valuesByTask(values).get(taskId) ?? [])
    .filter((entry) => !hiddenFieldIds.includes(entry.fieldId))
    .map((entry) => ({
      fieldId: entry.fieldId,
      name: entry.fieldName,
      type: entry.fieldType as CustomFieldType,
      value: entry.value ?? "",
    }))
    .filter((field) =>
      field.type === "boolean"
        ? field.value === "true"
        : !isCustomFieldValueEmpty(field.type, field.value),
    );
}
