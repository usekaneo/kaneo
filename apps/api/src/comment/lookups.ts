import { Effect } from "effect";
import { findOwnComment } from "../database/lookups";
import { Database } from "../effect/database";
import { CommentNotFoundOrNotAuthor } from "./errors";

export const ownCommentById = Effect.fn("comment.ownCommentById")(function* (
  id: string,
  userId: string,
) {
  const database = yield* Database;
  const [comment] = yield* database.query((db) =>
    findOwnComment(id, userId, db),
  );

  if (!comment) {
    return yield* new CommentNotFoundOrNotAuthor({ id, userId });
  }

  return comment;
});
