import { and, eq, inArray, not } from "drizzle-orm";
import {
  filterUnassignedTasks,
  removeAssignee,
} from "../task/assignees/task-assignees";
import createActivities from "../activity/controllers/create-activities";
import { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import { projectAccessCondition } from "./project-access-condition";

export async function unassignInaccessibleTasks(
  database: DbOrTx,
  change: { workspaceId: string; userId: string; actorId: string },
): Promise<{ id: string; projectId: string }[]> {
  const unassigned = await removeAssignee(
    database,
    change.userId,
    inArray(
      schema.taskTable.projectId,
      database
        .select({ id: schema.projectTable.id })
        .from(schema.projectTable)
        .where(
          and(
            eq(schema.projectTable.workspaceId, change.workspaceId),
            not(projectAccessCondition(change.userId, schema.projectTable.id)),
          ),
        ),
    ),
  );

  // History says "unassigned" only for tasks left with nobody on them; a task
  // that merely lost one of several assignees still has its primary.
  const emptied = new Set(
    await filterUnassignedTasks(
      database,
      unassigned.map((task) => task.id),
    ),
  );
  await createActivities(
    unassigned
      .filter((task) => emptied.has(task.id))
      .map((task) => ({
        taskId: task.id,
        type: "unassigned",
        userId: change.actorId,
        content: null,
        eventData: {},
      })),
    database,
  );

  return unassigned;
}
