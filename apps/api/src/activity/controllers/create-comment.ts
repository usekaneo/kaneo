import db from "../../database";
import { activityTable } from "../../database/schema";
import type { CommentMention } from "../comment-mentions";

async function createComment(
  taskId: string,
  userId: string,
  content: string,
  mentions: CommentMention[],
) {
  const [activity] = await db
    .insert(activityTable)
    .values({
      taskId,
      type: "comment",
      userId,
      content,
      eventData: mentions.length > 0 ? { mentions } : null,
    })
    .returning();

  return activity;
}

export default createComment;
