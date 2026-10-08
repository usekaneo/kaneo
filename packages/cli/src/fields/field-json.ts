import type { CustomField } from "../api/custom-fields.js";
import { fieldOptions } from "./field-types.js";

export type FieldJson = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly defaultValue: string | null;
  readonly options: ReadonlyArray<string>;
};

export function toFieldJson(field: CustomField): FieldJson {
  return {
    id: field.id,
    name: field.name,
    type: field.type,
    required: field.required,
    defaultValue: field.defaultValue,
    options: fieldOptions(field.options),
  };
}
