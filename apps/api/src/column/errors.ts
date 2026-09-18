import { Data } from "effect";
import { HTTPException } from "hono/http-exception";

export class InvalidColumnName extends Data.TaggedError("InvalidColumnName")<{
  readonly name: string;
}> {}

export class ReservedColumnSlug extends Data.TaggedError("ReservedColumnSlug")<{
  readonly slug: string;
}> {}

export class DuplicateColumnSlug extends Data.TaggedError(
  "DuplicateColumnSlug",
)<{
  readonly projectId: string;
  readonly slug: string;
}> {}

export class ColumnCreateFailed extends Data.TaggedError("ColumnCreateFailed")<{
  readonly projectId: string;
}> {}

export class ColumnUpdateFailed extends Data.TaggedError("ColumnUpdateFailed")<{
  readonly id: string;
}> {}

export class ColumnHasTasks extends Data.TaggedError("ColumnHasTasks")<{
  readonly id: string;
  readonly count: number;
}> {}

export class ColumnNotInProject extends Data.TaggedError("ColumnNotInProject")<{
  readonly id: string;
  readonly projectId: string;
}> {}

export type ColumnError =
  | InvalidColumnName
  | ReservedColumnSlug
  | DuplicateColumnSlug
  | ColumnCreateFailed
  | ColumnUpdateFailed
  | ColumnHasTasks
  | ColumnNotInProject;

export function columnErrorToHttpException(error: ColumnError): HTTPException {
  switch (error._tag) {
    case "InvalidColumnName":
      return new HTTPException(400, {
        message: "Column name must contain at least one alphanumeric character",
      });
    case "ReservedColumnSlug":
      return new HTTPException(409, {
        message: `Column slug "${error.slug}" is reserved for virtual task statuses`,
      });
    case "DuplicateColumnSlug":
      return new HTTPException(409, {
        message: `Column with slug "${error.slug}" already exists in this project`,
      });
    case "ColumnCreateFailed":
      return new HTTPException(500, { message: "Failed to create column" });
    case "ColumnUpdateFailed":
      return new HTTPException(500, { message: "Failed to update column" });
    case "ColumnHasTasks":
      return new HTTPException(409, {
        message:
          "Cannot delete column that contains tasks. Move or delete tasks first.",
      });
    case "ColumnNotInProject":
      return new HTTPException(400, {
        message: `Column ${error.id} does not belong to this project`,
      });
    default:
      return error satisfies never;
  }
}
