import { and, eq } from "drizzle-orm";
import type { DrizzleClient } from "./client";
import {
  activityTable,
  columnTable,
  customFieldDefinitionTable,
  labelTable,
  projectTable,
  taskRelationTable,
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

export function findTaskRefInWorkspace(
  taskId: string,
  workspaceId: string,
  client: DrizzleClient,
) {
  return client
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(eq(taskTable.id, taskId), eq(projectTable.workspaceId, workspaceId)),
    )
    .limit(1);
}

export function findTaskRelation(id: string, client: DrizzleClient) {
  return client
    .select({
      sourceTaskId: taskRelationTable.sourceTaskId,
      targetTaskId: taskRelationTable.targetTaskId,
    })
    .from(taskRelationTable)
    .where(eq(taskRelationTable.id, id))
    .limit(1);
}

export function findColumn(id: string, client: DrizzleClient) {
  return client.query.columnTable.findFirst({ where: eq(columnTable.id, id) });
}

export function findProject(id: string, client: DrizzleClient) {
  return client.query.projectTable.findFirst({
    where: eq(projectTable.id, id),
  });
}

export function findCustomField(id: string, client: DrizzleClient) {
  return client
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.id, id))
    .limit(1);
}
