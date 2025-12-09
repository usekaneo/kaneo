import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";

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

  return activities;
}

export default getActivitiesFromTaskId;
