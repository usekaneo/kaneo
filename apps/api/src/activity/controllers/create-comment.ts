import db from "../../database";
import { activityTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function createComment(taskId: string, userId: string, content: string) {
  const activity = await db.insert(activityTable).values({
    taskId,
    type: "comment",
    userId,
    content,
  });

  await publishEvent("task.comment_added", {
    taskId,
    commenterId: userId,
    content,
  });

  return activity;
}

export default createComment;
