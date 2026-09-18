import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { CommentNotFoundOrNotAuthor } from "../../comment/errors";
import { ownCommentById } from "../../comment/lookups";
import { AssetCleanup } from "../../comment/services";
import { activityTable, taskTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { Events } from "../../effect/events";

const updateComment = Effect.fn("comment.updateComment")(function* (
  userId: string,
  id: string,
  content: string,
) {
  const database = yield* Database;
  const events = yield* Events;
  const assets = yield* AssetCleanup;

  const existing = yield* ownCommentById(id, userId);

  const [updated] = yield* database.query((db) =>
    db
      .update(activityTable)
      .set({ content })
      .where(
        and(
          eq(activityTable.id, id),
          eq(activityTable.userId, userId),
          eq(activityTable.type, "comment"),
        ),
      )
      .returning(),
  );

  if (!updated) {
    return yield* new CommentNotFoundOrNotAuthor({ id, userId });
  }

  const [task] = yield* database.query((db) =>
    db
      .select({ projectId: taskTable.projectId })
      .from(taskTable)
      .where(eq(taskTable.id, updated.taskId))
      .limit(1),
  );

  if (task) {
    yield* events.publish("comment.updated", {
      ...updated,
      projectId: task.projectId,
      userId,
    });
  }

  yield* assets.deleteOrphaned(existing.content, content, {
    taskId: existing.taskId,
  });

  return updated;
});

export default updateComment;
