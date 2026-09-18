import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { CommentNotFoundOrNotAuthor } from "../../comment/errors";
import { ownCommentById } from "../../comment/lookups";
import { AssetCleanup } from "../../comment/services";
import { activityTable, taskTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { Events } from "../../effect/events";

const deleteComment = Effect.fn("comment.deleteComment")(function* (
  userId: string,
  id: string,
) {
  const database = yield* Database;
  const events = yield* Events;
  const assets = yield* AssetCleanup;

  const existing = yield* ownCommentById(id, userId);

  const [deletedComment] = yield* database.query((db) =>
    db
      .delete(activityTable)
      .where(
        and(
          eq(activityTable.id, id),
          eq(activityTable.userId, userId),
          eq(activityTable.type, "comment"),
        ),
      )
      .returning(),
  );

  if (!deletedComment) {
    return yield* new CommentNotFoundOrNotAuthor({ id, userId });
  }

  const [task] = yield* database.query((db) =>
    db
      .select({ projectId: taskTable.projectId })
      .from(taskTable)
      .where(eq(taskTable.id, deletedComment.taskId))
      .limit(1),
  );

  if (task) {
    yield* events.publish("comment.deleted", {
      ...deletedComment,
      projectId: task.projectId,
      userId,
    });
  }

  yield* assets.deleteOrphaned(existing.content, null, {
    taskId: existing.taskId,
  });

  return deletedComment;
});

export default deleteComment;
