import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";

async function getActivitiesFromTaskId(taskId: string, limit?: number) {
  const activities = await db.query.activityTable.findMany({
    where: eq(activityTable.taskId, taskId),
    orderBy: [desc(activityTable.createdAt), desc(activityTable.id)],
    limit,
  });

  activities.forEach((x) => {
    if (x.content && x.type !== "comment") {
      x.content = x.content.replace(/\n+/g, "\n");
    }
  });

  return activities;
}

export default getActivitiesFromTaskId;
