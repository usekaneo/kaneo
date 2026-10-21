import { and, eq, inArray, not, sql } from "drizzle-orm";
import createActivities from "../activity/controllers/create-activities";
import { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import { projectAccessCondition } from "./project-access-condition";

export async function unassignInaccessibleTasks(
  database: DbOrTx,
  change: {
    workspaceId: string;
    userId: string;
    actorId: string | null;
    reason?: "project-access" | "workspace-membership";
  },
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
                change.reason === "workspace-membership"
                  ? undefined
                  : not(
                      projectAccessCondition(
                        change.userId,
                        schema.projectTable.id,
                      ),
                    ),
              ),
            ),
        ),
      ),
    )
    .returning({
      id: schema.taskTable.id,
      projectId: schema.taskTable.projectId,
      hasOtherAssignees: sql<boolean>`exists (select 1 from ${schema.taskCoAssigneeTable} where ${schema.taskCoAssigneeTable.taskId} = ${schema.taskTable.id} and ${schema.taskCoAssigneeTable.userId} <> ${change.userId})`,
    });

  const removed = await database
    .delete(schema.taskCoAssigneeTable)
    .where(
      and(
        eq(schema.taskCoAssigneeTable.userId, change.userId),
        inArray(
          schema.taskCoAssigneeTable.taskId,
          database
            .select({ id: schema.taskTable.id })
            .from(schema.taskTable)
            .innerJoin(
              schema.projectTable,
              eq(schema.taskTable.projectId, schema.projectTable.id),
            )
            .where(
              and(
                eq(schema.projectTable.workspaceId, change.workspaceId),
                change.reason === "workspace-membership"
                  ? undefined
                  : not(
                      projectAccessCondition(
                        change.userId,
                        schema.projectTable.id,
                      ),
                    ),
              ),
            ),
        ),
      ),
    )
    .returning({
      id: schema.taskCoAssigneeTable.taskId,
      projectId: sql<string>`(select ${schema.taskTable.projectId} from ${schema.taskTable} where ${schema.taskTable.id} = ${schema.taskCoAssigneeTable.taskId})`,
    });
  const removedTasks = removed;
  const [person] =
    unassigned.length || removed.length
      ? await database
          .select({ name: schema.userTable.name })
          .from(schema.userTable)
          .where(eq(schema.userTable.id, change.userId))
          .limit(1)
      : [];

  await createActivities(
    unassigned.map((task) => ({
      taskId: task.id,
      type: task.hasOtherAssignees ? "assignee_removed" : "unassigned",
      userId: change.actorId,
      content: null,
      eventData: task.hasOtherAssignees
        ? {
            removedAssigneeId: change.userId,
            removedAssignee: person?.name ?? "",
          }
        : {},
    })),
    database,
  );

  await createActivities(
    removedTasks.map((task) => ({
      taskId: task.id,
      type: "assignee_removed",
      userId: change.actorId,
      content: null,
      eventData: {
        removedAssigneeId: change.userId,
        removedAssignee: person?.name ?? "",
      },
    })),
    database,
  );
  return [
    ...new Map(
      [...unassigned, ...removedTasks].map((task) => [task.id, task]),
    ).values(),
  ];
}
