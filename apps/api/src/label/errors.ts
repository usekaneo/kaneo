import { Data } from "effect";
import { HTTPException } from "hono/http-exception";

export class LabelWorkspaceMismatch extends Data.TaggedError(
  "LabelWorkspaceMismatch",
)<{
  readonly labelId: string;
  readonly taskId: string;
}> {}

export class LabelNotAssigned extends Data.TaggedError("LabelNotAssigned")<{
  readonly id: string;
}> {}

export class LabelAttachFailed extends Data.TaggedError("LabelAttachFailed")<{
  readonly id: string;
  readonly taskId: string;
}> {}

export class LabelDetachFailed extends Data.TaggedError("LabelDetachFailed")<{
  readonly id: string;
}> {}

export type LabelError =
  | LabelWorkspaceMismatch
  | LabelNotAssigned
  | LabelAttachFailed
  | LabelDetachFailed;

// Statuses and messages match what the controllers threw before the migration.
export function labelErrorToHttpException(error: LabelError): HTTPException {
  switch (error._tag) {
    case "LabelWorkspaceMismatch":
      return new HTTPException(400, {
        message: "Label and task must belong to the same workspace",
      });
    case "LabelNotAssigned":
      return new HTTPException(400, {
        message: "Label is not assigned to a task",
      });
    case "LabelAttachFailed":
      return new HTTPException(500, {
        message: "Failed to attach label to task",
      });
    case "LabelDetachFailed":
      return new HTTPException(500, {
        message: "Failed to detach label from task",
      });
    default:
      return error satisfies never;
  }
}
