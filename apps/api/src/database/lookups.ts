import { eq } from "drizzle-orm";
import type { DrizzleClient } from "./client";
import { labelTable, projectTable, taskTable } from "./schema";

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
