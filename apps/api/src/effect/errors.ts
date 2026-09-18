import { Data } from "effect";
import { HTTPException } from "hono/http-exception";

export type NotFoundEntity = "Label" | "Task" | "Time entry";

export class NotFound extends Data.TaggedError("NotFound")<{
  readonly entity: NotFoundEntity;
  readonly id: string;
}> {}

export function notFoundToHttpException(error: NotFound): HTTPException {
  return new HTTPException(404, { message: `${error.entity} not found` });
}
