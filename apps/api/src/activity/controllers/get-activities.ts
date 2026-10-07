import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";
import { redactInaccessibleMoves } from "../redact-inaccessible-moves";

async function getActivitiesFromTaskId(
  taskId: string,
  viewerId: string,
  limit?: number,
) {
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

  return redactInaccessibleMoves(viewerId, activities);
}

export default getActivitiesFromTaskId;
