import db from "../../database";
import { activityTable } from "../../database/schema";

async function createComment(data: {
  taskId: string;
  content: string;
  userEmail: string;
}) {
  const activity = await db.insert(activityTable).values({
    ...data,
    type: "comment",
  });
  return activity;
}

export default createComment;
