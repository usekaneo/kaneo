import { HTTPException } from "hono/http-exception";
import {
  isCustomFieldValueEmpty,
  validateCustomFieldValue,
} from "../task/validate-task-fields";

const NUMBER_PATTERN = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i;

type CustomFieldDefinitionInput = {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string | null;
  options?: string[] | null;
};

function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}

function assertValidDefaultForType(
  trimmedValue: string,
  { name, type, options }: CustomFieldDefinitionInput,
) {
  if (type === "number") {
    const parsed = Number(trimmedValue);
    if (
      !NUMBER_PATTERN.test(trimmedValue) ||
      Number.isNaN(parsed) ||
      !Number.isFinite(parsed)
    ) {
      badRequest("Default value must be a valid number for number type fields");
    }
    return;
  }

  if (type === "boolean") {
    if (trimmedValue !== "true" && trimmedValue !== "false") {
      badRequest(
        "Default value must be 'true' or 'false' for boolean type fields",
      );
    }
    return;
  }

  if (type === "date") {
    const error = validateCustomFieldValue(trimmedValue, "date", name);
    if (error) badRequest(error);
    return;
  }

  if (type === "dropdown" && options && options.length > 0) {
    const normalizedOptions = options.map((option) => option.trim());
    if (!normalizedOptions.includes(trimmedValue)) {
      badRequest("Default value must be one of the dropdown options");
    }
  }
}

export function assertValidDefinition(input: CustomFieldDefinitionInput) {
  const { name, type, required, defaultValue, options } = input;

  if (required && (defaultValue == null || defaultValue.trim() === "")) {
    badRequest("Required fields must have a default value");
  }

  const trimmedValue = defaultValue?.trim();
  if (trimmedValue) {
    assertValidDefaultForType(trimmedValue, input);
  }

  if (type === "dropdown" && (!options || options.length < 1)) {
    badRequest("Dropdown fields must have at least one option");
  }

  if (type === "multiselect") {
    const normalizedOptions = new Set(
      (options ?? []).map((option) => option.trim()).filter(Boolean),
    );
    if (normalizedOptions.size < 2) {
      badRequest("Multiselect fields must have at least 2 options");
    }
  }

  if (type === "multiselect" && defaultValue != null) {
    const empty = isCustomFieldValueEmpty(defaultValue, "multiselect");
    if (required && empty) {
      badRequest("Required fields must have a default value");
    }
    if (!empty) {
      const error = validateCustomFieldValue(
        defaultValue,
        "multiselect",
        name,
        options,
      );
      if (error) badRequest(error);
    }
  }
}
