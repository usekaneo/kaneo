import { toFieldKind } from "@/components/project/custom-fields/field-kinds";
import type {
  CustomFieldDefinition,
  CustomFieldType,
  FieldKind,
} from "@/components/project/custom-fields/types";
import { moveItem } from "@/components/project/sortable/apply-order";

export type FieldFormState = {
  kind: FieldKind;
  name: string;
  options: string[];
  multiple: boolean;
  required: boolean;
  defaultValue: string;
  defaultValues: string[];
};

export type FieldFormIssue =
  | "nameRequired"
  | "optionsRequired"
  | "moreOptionsRequired"
  | "defaultRequired";

export const EMPTY_FIELD_FORM: FieldFormState = {
  kind: "text",
  name: "",
  options: [],
  multiple: false,
  required: false,
  defaultValue: "",
  defaultValues: [],
};

function parseDefaultValues(value: string | null) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function initialDefault(field: CustomFieldDefinition) {
  if (field.type === "multiselect") return "";
  if (field.type === "boolean") {
    return field.defaultValue === "true" ? "true" : "false";
  }
  return field.defaultValue ?? "";
}

export function formFromField(field?: CustomFieldDefinition | null) {
  if (!field) return EMPTY_FIELD_FORM;

  const multiple = field.type === "multiselect";
  return {
    kind: toFieldKind(field.type),
    name: field.name,
    options: field.options ?? [],
    multiple,
    required: field.required,
    defaultValue: initialDefault(field),
    defaultValues: multiple ? parseDefaultValues(field.defaultValue) : [],
  } satisfies FieldFormState;
}

export function setKind(state: FieldFormState, kind: FieldKind) {
  if (kind === state.kind) return state;
  return {
    ...state,
    kind,
    multiple: false,
    defaultValue: kind === "boolean" ? "false" : "",
    defaultValues: [],
  };
}

export function setMultiple(state: FieldFormState, multiple: boolean) {
  if (multiple === state.multiple) return state;
  return multiple
    ? {
        ...state,
        multiple,
        defaultValue: "",
        defaultValues: state.defaultValue ? [state.defaultValue] : [],
      }
    : {
        ...state,
        multiple,
        defaultValue: state.defaultValues[0] ?? "",
        defaultValues: [],
      };
}

export function addOption(state: FieldFormState, raw: string) {
  const option = raw.trim();
  if (!option || state.options.includes(option)) return state;
  return { ...state, options: [...state.options, option] };
}

export function removeOption(state: FieldFormState, option: string) {
  return {
    ...state,
    options: state.options.filter((candidate) => candidate !== option),
    defaultValue: state.defaultValue === option ? "" : state.defaultValue,
    defaultValues: state.defaultValues.filter((value) => value !== option),
  };
}

export function renameOption(state: FieldFormState, from: string, raw: string) {
  const to = raw.trim();
  if (!to || to === from || state.options.includes(to)) return state;

  const rename = (value: string) => (value === from ? to : value);
  return {
    ...state,
    options: state.options.map(rename),
    defaultValue: rename(state.defaultValue),
    defaultValues: state.defaultValues.map(rename),
  };
}

export function moveOption(state: FieldFormState, from: number, to: number) {
  return { ...state, options: moveItem(state.options, from, to) };
}

export function toApiType(state: FieldFormState): CustomFieldType {
  return state.kind === "dropdown" && state.multiple
    ? "multiselect"
    : state.kind;
}

export function toApiDefault(state: FieldFormState): string | null {
  if (toApiType(state) === "multiselect") {
    return state.defaultValues.length > 0
      ? JSON.stringify(state.defaultValues)
      : null;
  }

  const trimmed = state.defaultValue.trim();
  if (!trimmed) return null;
  return state.kind === "text" ? state.defaultValue : trimmed;
}

export function getFormIssue(state: FieldFormState): FieldFormIssue | null {
  if (!state.name.trim()) return "nameRequired";
  if (
    state.kind === "dropdown" &&
    state.options.length < (state.multiple ? 2 : 1)
  ) {
    return state.multiple ? "moreOptionsRequired" : "optionsRequired";
  }
  if (state.required && toApiDefault(state) === null) return "defaultRequired";
  return null;
}

export function toCreatePayload(state: FieldFormState, projectId: string) {
  return {
    projectId,
    name: state.name.trim(),
    type: toApiType(state),
    required: state.required,
    defaultValue: toApiDefault(state) ?? undefined,
    options: state.kind === "dropdown" ? state.options : undefined,
  };
}

export function toUpdatePayload(state: FieldFormState) {
  return {
    name: state.name.trim(),
    type: toApiType(state),
    required: state.required,
    defaultValue: toApiDefault(state),
    ...(state.kind === "dropdown" ? { options: state.options } : {}),
  };
}
