import { sql } from "drizzle-orm";
import { projectAccessCondition } from "../project-access/project-access-condition";
import type { TaskReadDatabase } from "./bounded-read";

/** One bounded page query, independent of board filtering and pagination. */
export async function getTaskAncestors(
  db: TaskReadDatabase,
  taskIds: string[],
  workspaceId: string,
  userId: string,
) {
  type Row = {
    taskId: string;
    id: string;
    title: string;
    projectId: string;
    depth: number;
  };
  const result = new Map<string, Array<Omit<Row, "taskId" | "depth">>>();
  if (!taskIds.length) return result;
  const rows = await db.execute<Row>(sql`
    with recursive ancestry as (
      select root.id as "taskId", root.id, root.title, root.project_id as "projectId", 0 as depth, array[root.id]::text[] as path
      from task root join project root_project on root_project.id = root.project_id
      where root.id in (select jsonb_array_elements_text(${JSON.stringify(taskIds)}::jsonb))
        and root_project.workspace_id = ${workspaceId}
        and ${projectAccessCondition(userId, sql`root_project.id`)}
      union all
      select ancestry."taskId", parent.id, parent.title, parent.project_id, ancestry.depth + 1, ancestry.path || parent.id
      from ancestry
      cross join lateral (
        select parent.id, parent.title, parent.project_id
        from task_relation relation
        join task parent on parent.id = relation.source_task_id
        join project parent_project on parent_project.id = parent.project_id
        where relation.target_task_id = ancestry.id and relation.relation_type = 'subtask'
          and parent_project.workspace_id = ${workspaceId}
          and ${projectAccessCondition(userId, sql`parent_project.id`)}
          and not parent.id = any(ancestry.path)
        -- Legacy relations can have multiple parents. Choose one stable trail.
        order by relation.created_at, relation.id
        limit 1
      ) parent
      where ancestry.depth < 32
    )
    select "taskId", id, title, "projectId", depth from ancestry where depth > 0 order by "taskId", depth
  `);
  for (const { taskId, depth: _depth, ...ancestor } of rows.rows) {
    const trail = result.get(taskId) ?? [];
    trail.push(ancestor);
    result.set(taskId, trail);
  }
  return result;
}
