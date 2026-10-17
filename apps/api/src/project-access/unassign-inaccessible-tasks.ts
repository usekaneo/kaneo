import { and, eq, inArray, not } from "drizzle-orm";
import createActivities from "../activity/controllers/create-activities";
import { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import { projectAccessCondition } from "./project-access-condition";

export async function unassignInaccessibleTasks(
  database: DbOrTx,
  change: { workspaceId: string; userId: string; actorId: string },
): Promise<{ id: string; projectId: string }[]> {
  const unassigned = await database
    .update(schema.taskTable)
    .set({ userId: null })
    .where(
      and(
        eq(schema.taskTable.userId, change.userId),
        inArray(
          schema.taskTable.projectId,
          database
            .select({ id: schema.projectTable.id })
            .from(schema.projectTable)
            .where(
              and(
                eq(schema.projectTable.workspaceId, change.workspaceId),
                not(
                  projectAccessCondition(change.userId, schema.projectTable.id),
                ),
              ),
            ),
        ),
      ),
    )
    .returning({
      id: schema.taskTable.id,
      projectId: schema.taskTable.projectId,
    });

  await createActivities(
    unassigned.map((task) => ({
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
