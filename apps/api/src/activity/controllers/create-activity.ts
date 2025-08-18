import db from "../../database";
import { activityTable } from "../../database/schema";

async function createActivity(
  taskId: string,
  type: string,
  userId: string,
  content: string,
) {
  const activity = await db.insert(activityTable).values({
    taskId,
    type,
    userId,
    content,
  });
  return activity;
}

export default createActivity;
