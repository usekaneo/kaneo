import db from "../../database";
import { activityTable } from "../../database/schema";

async function createActivity(
  taskId: string,
  type: string,
  userEmail: string,
  content: string,
) {
  const activity = await db.insert(activityTable).values({
    taskId,
    type,
    userEmail,
    content,
  });
  return activity;
}

export default createActivity;
