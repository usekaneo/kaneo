import { sql } from "drizzle-orm";
import { boundedTaskRead } from "./bounded-read";

/** Broadcast only project IDs: each board re-reads ancestry with its own access. */
export function getTaskDescendantProjects(
  taskIds: string[],
  includeRoots = false,
) {
  if (!taskIds.length) return Promise.resolve([] as { projectId: string }[]);
  return boundedTaskRead(async (tx) => {
    const rows = await tx.execute<{ projectId: string }>(sql`
      with recursive descendants as (
        select task.id, task.project_id, project.workspace_id from task
        join project on project.id = task.project_id
        where task.id in (select jsonb_array_elements_text(${JSON.stringify(taskIds)}::jsonb))
        union
        select child.id, child.project_id, child_project.workspace_id from descendants
        join task_relation relation on relation.source_task_id = descendants.id and relation.relation_type = 'subtask'
        join task child on child.id = relation.target_task_id
        join project child_project on child_project.id = child.project_id and child_project.workspace_id = descendants.workspace_id
      ) select distinct project_id as "projectId" from descendants
      where ${includeRoots} or id not in (select jsonb_array_elements_text(${JSON.stringify(taskIds)}::jsonb))
    `);
    return rows.rows;
  });
}
