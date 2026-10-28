import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import type { IntegrationDatabase } from "../../plugins/github/services/integration-task-scope";

export async function getAuthorizedSyncProject(
  projectId: string,
  authorizedWorkspaceId: string,
  database: IntegrationDatabase = db,
  lock = false,
) {
  const query = database
    .select()
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(projectTable.workspaceId, authorizedWorkspaceId),
      ),
    );
  const [project] = await (lock ? query.for("share") : query);
  if (!project)
    throw new HTTPException(403, {
      message: "Project no longer belongs to the authorized workspace",
    });
  return project;
}
