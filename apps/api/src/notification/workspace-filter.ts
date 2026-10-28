import { sql } from "drizzle-orm";
import { notificationTable } from "../database/schema";

// Resolve the resource's current workspace, rather than trusting eventData,
// which integrations can supply and older notifications may omit.
export function notificationWorkspaceFilter(workspaceId?: string) {
  if (!workspaceId) return undefined;
  return sql<boolean>`(
    (${notificationTable.resourceId} IS NULL AND ${notificationTable.resourceType} IS NULL)
    OR
    (${notificationTable.resourceType} = 'workspace' AND ${notificationTable.resourceId} = ${workspaceId})
    OR (${notificationTable.resourceType} = 'agent_run' AND EXISTS (
      SELECT 1 FROM agent_run r JOIN agent_conversation c ON c.id = r.conversation_id
      WHERE r.id = ${notificationTable.resourceId} AND c.workspace_id = ${workspaceId}
    ))
    OR (${notificationTable.resourceType} = 'task' AND EXISTS (
      SELECT 1 FROM task AS inbox_task
      JOIN project AS inbox_project ON inbox_project.id = inbox_task.project_id
      WHERE inbox_task.id = ${notificationTable.resourceId}
        AND inbox_project.workspace_id = ${workspaceId}
    ))
  )`;
}
