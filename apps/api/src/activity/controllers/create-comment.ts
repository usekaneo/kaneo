import db from "../../database";
import { activityTable } from "../../database/schema";

async function createComment(taskId: string, userId: string, content: string) {
  const activity = await db.insert(activityTable).values({
    taskId,
    type: "comment",
    userId,
    content,
  });
  return activity;
}

export default createComment;
