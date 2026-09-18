import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";
import { withCommentExtras } from "./comment-extras";

async function getActivitiesFromTaskId(taskId: string) {
  const activities = await db.query.activityTable.findMany({
    where: eq(activityTable.taskId, taskId),
    orderBy: [desc(activityTable.createdAt)],
  });

  activities.forEach((x) => {
    if (x.content) {
      x.content = x.content.replace(/\n+/g, "\n");
    }
  });

  return withCommentExtras(activities);
}

export default getActivitiesFromTaskId;
