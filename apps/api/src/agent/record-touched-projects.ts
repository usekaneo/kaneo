import { eq, sql } from "drizzle-orm";
import db, { schema } from "../database";
import type { AgentDatabase } from "./access";
import { uniqueProjectIds } from "./touched-project-ids";

// Merges in SQL so parallel tool calls cannot overwrite each other. Callers
// record before the data reaches the model or a viewer-visible row.
export async function recordTouchedProjects(
  runId: string,
  ids: Iterable<string | null | undefined>,
  database: AgentDatabase = db,
) {
  const projectIds = uniqueProjectIds(ids);
  if (projectIds.length === 0) return;
  const added = sql`array[${sql.join(
    projectIds.map((id) => sql`${id}`),
    sql`, `,
  )}]::text[]`;
  await database
    .update(schema.agentRunTable)
    .set({
      touchedProjectIds: sql`array(select distinct id from unnest(${schema.agentRunTable.touchedProjectIds} || ${added}) as merged(id) order by id)`,
    })
    .where(eq(schema.agentRunTable.id, runId));
}
