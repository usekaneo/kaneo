import db from "../../database";
import { activityTable } from "../../database/schema";

async function createActivity(body: {
  taskId: string;
  type: string;
  userEmail: string;
  content: string;
}) {
  const activity = await db.insert(activityTable).values(body);
  return activity;
}

export default createActivity;
