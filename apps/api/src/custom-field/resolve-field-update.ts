import { HTTPException } from "hono/http-exception";
import { assertValidDefinition } from "./assert-valid-definition";
import {
  convertChoiceValue,
  isChoiceType,
  normalizeOptions,
  readOptions,
} from "./choice-options";

export type CurrentCustomField = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  options: unknown;
};

export type CustomFieldUpdateInput = {
  name?: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | null;
  options?: string[];
};

export type ResolvedFieldUpdate = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  options: unknown;
  removedOptions: string[];
};

function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}

function resolveType(field: CurrentCustomField, requested?: string) {
  const type = requested ?? field.type;
  if (type === field.type) return type;
  if (isChoiceType(type) && isChoiceType(field.type)) return type;

  badRequest(
    "The type of a custom field can't change. Only dropdown and multiselect fields can switch between each other.",
  );
}

function resolveDefault(
  field: CurrentCustomField,
  type: string,
  requested: string | null | undefined,
) {
  if (requested !== undefined) {
    if (requested === null || requested.trim() === "") return null;
    return type === "date" ? requested.trim() : requested;
  }

  if (
    field.defaultValue === null ||
    type === field.type ||
    !isChoiceType(type) ||
    !isChoiceType(field.type)
  ) {
    return field.defaultValue;
  }

  const converted = convertChoiceValue(field.defaultValue, field.type, type);
  if (converted === undefined) {
    badRequest(
      "The default has more than one option picked. Send a default with one option.",
    );
  }
  return converted || null;
}

export function resolveFieldUpdate(
  field: CurrentCustomField,
  input: CustomFieldUpdateInput,
): ResolvedFieldUpdate {
  const type = resolveType(field, input.type);

  const name = input.name === undefined ? field.name : input.name.trim();
  if (!name) badRequest("Name cannot be empty");

  if (input.options !== undefined && !isChoiceType(type)) {
    badRequest("Only dropdown and multiselect fields have options");
  }

  const previousOptions = readOptions(field.options);
  const options = isChoiceType(type)
    ? input.options === undefined
      ? previousOptions
      : normalizeOptions(input.options)
    : null;

  const required = input.required ?? field.required;
  const defaultValue = resolveDefault(field, type, input.defaultValue);

  assertValidDefinition({ name, type, required, defaultValue, options });

  return {
    name,
    type,
    required,
    defaultValue,
    options: options ?? field.options,
    removedOptions: options
      ? previousOptions.filter((option) => !options.includes(option))
      : [],
  };
}
