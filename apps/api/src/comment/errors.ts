import { Data } from "effect";
import { HTTPException } from "hono/http-exception";

export class CommentNotFoundOrNotAuthor extends Data.TaggedError(
  "CommentNotFoundOrNotAuthor",
)<{
  readonly id: string;
  readonly userId: string;
}> {}

export class CommentCreateFailed extends Data.TaggedError(
  "CommentCreateFailed",
)<{
  readonly taskId: string;
}> {}

export type CommentError = CommentNotFoundOrNotAuthor | CommentCreateFailed;

export function commentErrorToHttpException(
  error: CommentError,
): HTTPException {
  switch (error._tag) {
    case "CommentNotFoundOrNotAuthor":
      return new HTTPException(404, {
        message: "Comment not found or you are not the author",
      });
    case "CommentCreateFailed":
      return new HTTPException(500, {
        message: "Failed to create activity",
      });
    default:
      return error satisfies never;
  }
}
