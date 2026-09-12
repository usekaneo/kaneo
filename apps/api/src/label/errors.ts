import { Data } from "effect";
import { HTTPException } from "hono/http-exception";

export class LabelNotFound extends Data.TaggedError("LabelNotFound")<{
  readonly id: string;
}> {}

export class TaskNotFound extends Data.TaggedError("TaskNotFound")<{
  readonly taskId: string;
}> {}

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
  | LabelNotFound
  | TaskNotFound
  | LabelWorkspaceMismatch
  | LabelNotAssigned
  | LabelAttachFailed
  | LabelDetachFailed;

// Statuses and messages are the public contract the controllers produced
// before the Effect migration; they must not change.
export function labelErrorToHttpException(error: LabelError): HTTPException {
  switch (error._tag) {
    case "LabelNotFound":
      return new HTTPException(404, { message: "Label not found" });
    case "TaskNotFound":
      return new HTTPException(404, { message: "Task not found" });
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
