import { sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type db from "../database";
import { projectTable, taskRelationTable, taskTable } from "../database/schema";

export async function assertSubtaskAcyclic(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  workspaceId: string,
  sourceTaskId: string,
  targetTaskId: string,
) {
  // Serialize hierarchy edits so concurrent links cannot jointly create a cycle.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(1854, hashtext(${workspaceId}))`,
  );
  const result = await tx.execute<{ cyclic: boolean }>(sql`
    WITH RECURSIVE descendants(id) AS (
      SELECT ${targetTaskId}::text
      UNION
      SELECT relation.target_task_id
      FROM ${taskRelationTable} AS relation
      INNER JOIN descendants ON relation.source_task_id = descendants.id
      INNER JOIN ${taskTable} AS child ON child.id = relation.target_task_id
      INNER JOIN ${projectTable} AS project ON project.id = child.project_id
      WHERE relation.relation_type = 'subtask'
        AND project.workspace_id = ${workspaceId}
    )
    SELECT EXISTS (
      SELECT 1 FROM descendants WHERE id = ${sourceTaskId}
    ) AS cyclic
  `);
  if (result.rows[0]?.cyclic) {
    throw new HTTPException(400, {
      message: "A subtask relation cannot create a circular hierarchy",
    });
  }
}
