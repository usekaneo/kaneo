import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { deleteOrphanedAssets } from "../../storage/cleanup-assets";

type Database = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
export type RemovedComment = {
  comment: typeof activityTable.$inferSelect;
  // Null when the task vanished; no event is published then.
  projectId: string | null;
};

// Deletes the author's comment. Pair with publishCommentDeleted after the
// surrounding transaction commits.
export async function removeComment(
  database: Database,
  userId: string,
  id: string,
): Promise<RemovedComment> {
  const [comment] = await database
    .delete(activityTable)
    .where(
      and(
        eq(activityTable.id, id),
        eq(activityTable.userId, userId),
        eq(activityTable.type, "comment"),
      ),
    )
    .returning();

  if (!comment) {
    throw new HTTPException(404, {
      message: "Comment not found or you are not the author",
    });
  }

  const [task] = await database
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, comment.taskId))
    .limit(1);

  return { comment, projectId: task?.projectId ?? null };
}

export async function publishCommentDeleted(
  { comment, projectId }: RemovedComment,
  userId: string,
) {
  if (projectId) {
    await publishEvent("comment.deleted", { ...comment, projectId, userId });
  }

  deleteOrphanedAssets(comment.content, null, {
    taskId: comment.taskId,
  }).catch(() => {});
}

async function deleteComment(userId: string, id: string) {
  const removed = await removeComment(db, userId, id);
  await publishCommentDeleted(removed, userId);
  return removed.comment;
}

export default deleteComment;
