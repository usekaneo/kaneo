import { Data } from "effect";
import { HTTPException } from "hono/http-exception";

const DEFINITION_MESSAGES = {
  "required-default": "Required fields must have a default value",
  "number-default":
    "Default value must be a valid number for number type fields",
  "boolean-default":
    "Default value must be 'true' or 'false' for boolean type fields",
  "date-default":
    "Default value must be a valid date in ISO format (YYYY-MM-DD)",
  "dropdown-default": "Default value must be one of the dropdown options",
  "dropdown-options": "Dropdown fields must have at least one option",
} as const;

const VALUE_MESSAGES = {
  required: "This custom field is required",
  option: "Invalid option for this custom field",
  number: "Value must be a valid number",
  boolean: "Value must be true or false",
} as const;

export class InvalidCustomFieldDefinition extends Data.TaggedError(
  "InvalidCustomFieldDefinition",
)<{
  readonly reason: keyof typeof DEFINITION_MESSAGES;
}> {}

export class InvalidCustomFieldValue extends Data.TaggedError(
  "InvalidCustomFieldValue",
)<{
  readonly fieldId: string;
  readonly reason: keyof typeof VALUE_MESSAGES;
}> {}

export class CustomFieldCreateFailed extends Data.TaggedError(
  "CustomFieldCreateFailed",
)<{
  readonly projectId: string;
}> {}

export class CustomFieldOrProjectNotFound extends Data.TaggedError(
  "CustomFieldOrProjectNotFound",
)<{
  readonly id: string;
}> {}

export class ProjectWithoutWorkspace extends Data.TaggedError(
  "ProjectWithoutWorkspace",
)<{
  readonly projectId: string;
}> {}

export class CustomFieldNotInProject extends Data.TaggedError(
  "CustomFieldNotInProject",
)<{
  readonly id: string;
  readonly projectId: string;
}> {}

export type CustomFieldError =
  | InvalidCustomFieldDefinition
  | InvalidCustomFieldValue
  | CustomFieldCreateFailed
  | CustomFieldOrProjectNotFound
  | ProjectWithoutWorkspace
  | CustomFieldNotInProject;

export function customFieldErrorToHttpException(
  error: CustomFieldError,
): HTTPException {
  switch (error._tag) {
    case "InvalidCustomFieldDefinition":
      return new HTTPException(400, {
        message: DEFINITION_MESSAGES[error.reason],
      });
    case "InvalidCustomFieldValue":
      return new HTTPException(400, { message: VALUE_MESSAGES[error.reason] });
    case "CustomFieldCreateFailed":
      return new HTTPException(500, {
        message: "Failed to create custom field",
      });
    case "CustomFieldOrProjectNotFound":
      return new HTTPException(404, {
        message: "Custom field or project not found",
      });
    case "ProjectWithoutWorkspace":
      return new HTTPException(400, {
        message: "The project is not associated with a workspace",
      });
    case "CustomFieldNotInProject":
      return new HTTPException(400, {
        message: `Custom field ${error.id} does not belong to this project`,
      });
    default:
      return error satisfies never;
  }
}
