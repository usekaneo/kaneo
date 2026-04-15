import { and, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";
import type { CommentMention } from "../comment-mentions";

async function updateComment(
  userId: string,
  id: string,
  content: string,
  mentions: CommentMention[],
) {
  const [updatedComment] = await db
    .update(activityTable)
    .set({
      content,
      eventData: mentions.length > 0 ? { mentions } : null,
    })
    .where(and(eq(activityTable.id, id), eq(activityTable.userId, userId)))
    .returning();

  return updatedComment;
}

export default updateComment;
