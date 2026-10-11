import { sql } from "drizzle-orm";
import { taskTable } from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";

export function subtaskCandidateCondition({
  taskId,
  direction,
  workspaceId,
  userId,
}: {
  taskId: string;
  direction: "parent" | "child";
  workspaceId: string;
  userId: string;
}) {
  const nextId =
    direction === "child"
      ? sql`relation.source_task_id`
      : sql`relation.target_task_id`;
  const currentId =
    direction === "child"
      ? sql`relation.target_task_id`
      : sql`relation.source_task_id`;

  // Walk ancestors for a new child, descendants for a new parent. UNION also
  // terminates safely on pre-existing cycles.
  return sql<boolean>`(
    EXISTS (
      SELECT 1 FROM task AS anchor
      JOIN project AS anchor_project ON anchor_project.id = anchor.project_id
      WHERE anchor.id = ${taskId}
        AND anchor_project.workspace_id = ${workspaceId}
        AND ${projectAccessCondition(userId, sql`anchor.project_id`)}
    )
    AND ${taskTable.id} NOT IN (
      WITH RECURSIVE excluded(id) AS (
        SELECT ${taskId}::text
        UNION
        SELECT ${nextId}
        FROM task_relation AS relation
        JOIN excluded ON ${currentId} = excluded.id
        JOIN task AS related ON related.id = ${nextId}
        JOIN project AS related_project ON related_project.id = related.project_id
        WHERE relation.relation_type = 'subtask'
          AND related_project.workspace_id = ${workspaceId}
      )
      SELECT id FROM excluded
    )
    AND NOT EXISTS (
      SELECT 1 FROM task_relation AS existing_parent
      WHERE existing_parent.relation_type = 'subtask'
        AND existing_parent.target_task_id = ${
          direction === "child" ? taskTable.id : taskId
        }
    )
  )`;
}
