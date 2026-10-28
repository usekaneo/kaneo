import { type SQLWrapper, sql } from "drizzle-orm";

// Raw aliases keep these subqueries independent of the outer query's tables,
// which often include `workspace` or `project` themselves.

/** True when the workspace with this id is not archived. */
export function workspaceIsActive(workspaceId: SQLWrapper) {
  return sql<boolean>`not exists (
    select 1 from "workspace" as "archived_workspace"
    where "archived_workspace"."id" = ${workspaceId}
      and "archived_workspace"."archived_at" is not null
  )`;
}

/** True when the project with this id belongs to a workspace that is not archived. */
export function projectInActiveWorkspace(projectId: SQLWrapper) {
  return sql<boolean>`not exists (
    select 1 from "project" as "archived_project"
    inner join "workspace" as "archived_workspace"
      on "archived_workspace"."id" = "archived_project"."workspace_id"
    where "archived_project"."id" = ${projectId}
      and "archived_workspace"."archived_at" is not null
  )`;
}

/** Pauses deferred integration jobs without discarding their queued work. */
export function integrationInActiveWorkspace(integrationId: SQLWrapper) {
  return sql<boolean>`not exists (
    select 1 from "integration" as "archived_integration"
    inner join "project" as "archived_project" on "archived_project"."id" = "archived_integration"."project_id"
    inner join "workspace" as "archived_workspace" on "archived_workspace"."id" = "archived_project"."workspace_id"
    where "archived_integration"."id" = ${integrationId}
      and "archived_workspace"."archived_at" is not null
  )`;
}
