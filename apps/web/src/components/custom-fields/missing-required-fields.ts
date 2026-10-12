import type {
  CustomFieldDefinition,
  CustomFieldType,
} from "@/components/project/custom-fields/types";
import { parseMultiselect } from "./parse-multiselect";

export function isCustomFieldValueEmpty(type: CustomFieldType, raw: string) {
  if (type === "multiselect") return parseMultiselect(raw).length === 0;
  return raw.trim() === "";
}

export function findMissingRequiredFields(
  fields: CustomFieldDefinition[],
  values: Record<string, string>,
) {
  return fields.filter(
    (field) =>
      field.required &&
      field.type !== "boolean" &&
      isCustomFieldValueEmpty(field.type, values[field.id] ?? ""),
  );
}
