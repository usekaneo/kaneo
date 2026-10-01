import { and, eq, ne, sql } from "drizzle-orm";
import type db from "../database";
import { projectTable } from "../database/schema";

export async function findProjectKeyConflict(
  database: Pick<typeof db, "select">,
  workspaceId: string,
  key: string,
  excludeProjectId?: string,
) {
  const [conflict] = await database
    .select({ name: projectTable.name })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        excludeProjectId ? ne(projectTable.id, excludeProjectId) : undefined,
        sql`lower(${projectTable.slug}) = lower(${key})`,
      ),
    )
    .limit(1);

  return conflict;
}

export function projectKeyTakenMessage(key: string, projectName: string) {
  return `This workspace already has a project using the key "${key}" (${projectName}). Choose a different key.`;
}
