import { and, eq } from "drizzle-orm";
import type { DrizzleClient } from "./client";
import {
  activityTable,
  labelTable,
  projectTable,
  taskTable,
  timeEntryTable,
} from "./schema";

export function findLabel(id: string, client: DrizzleClient) {
  return client.query.labelTable.findFirst({ where: eq(labelTable.id, id) });
}

export type TaskRef = { id: string; projectId: string; workspaceId: string };

export function findTaskRef(taskId: string, client: DrizzleClient) {
  return client
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);
}

export function findTimeEntry(id: string, client: DrizzleClient) {
  return client.select().from(timeEntryTable).where(eq(timeEntryTable.id, id));
}

export function findOwnComment(
  id: string,
  userId: string,
  client: DrizzleClient,
) {
  return client
    .select({
      id: activityTable.id,
      content: activityTable.content,
      taskId: activityTable.taskId,
    })
    .from(activityTable)
    .where(
      and(
        eq(activityTable.id, id),
        eq(activityTable.userId, userId),
        eq(activityTable.type, "comment"),
      ),
    )
    .limit(1);
}
