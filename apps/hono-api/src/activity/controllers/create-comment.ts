import db from "../../database";
import { activityTable } from "../../database/schema";

async function createComment(
  taskId: string,
  userEmail: string,
  content: string,
) {
  const activity = await db.insert(activityTable).values({
    taskId,
    type: "comment",
    userEmail,
    content,
  });
  return activity;
}

export default createComment;
