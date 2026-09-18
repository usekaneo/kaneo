import { Data } from "effect";
import { HTTPException } from "hono/http-exception";

export class SelfRelation extends Data.TaggedError("SelfRelation")<{
  readonly taskId: string;
}> {}

export class RelatedTaskNotFound extends Data.TaggedError(
  "RelatedTaskNotFound",
)<{
  readonly role: "Source" | "Target";
  readonly taskId: string;
}> {}

export class RelationAlreadyExists extends Data.TaggedError(
  "RelationAlreadyExists",
)<{
  readonly sourceTaskId: string;
  readonly targetTaskId: string;
  readonly relationType: string;
}> {}

export class RelationCreateFailed extends Data.TaggedError(
  "RelationCreateFailed",
)<{
  readonly sourceTaskId: string;
  readonly targetTaskId: string;
}> {}

export type TaskRelationError =
  | SelfRelation
  | RelatedTaskNotFound
  | RelationAlreadyExists
  | RelationCreateFailed;

export function taskRelationErrorToHttpException(
  error: TaskRelationError,
): HTTPException {
  switch (error._tag) {
    case "SelfRelation":
      return new HTTPException(400, {
        message: "Cannot create a relation between a task and itself",
      });
    case "RelatedTaskNotFound":
      return new HTTPException(404, {
        message: `${error.role} task not found`,
      });
    case "RelationAlreadyExists":
      return new HTTPException(409, {
        message: "This relation already exists",
      });
    case "RelationCreateFailed":
      return new HTTPException(500, {
        message: "Failed to create task relation",
      });
    default:
      return error satisfies never;
  }
}
