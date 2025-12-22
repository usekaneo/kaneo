import db from "../../database";
import { activityTable } from "../../database/schema";
import { assertTaskWritable } from "../../utils/assert-task-writable";

async function createComment(taskId: string, userId: string, content: string) {
  await assertTaskWritable(taskId);

  const activity = await db.insert(activityTable).values({
    taskId,
    type: "comment",
    userId,
    content,
  });
  return activity;
}

export default createComment;
