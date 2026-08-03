import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable } from "../database/schema";

export default async function validateProjectScope(
  workspaceId: string,
  projectId: string,
) {
  const [project] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!project) {
    throw new HTTPException(400, {
      message: "Project does not belong to the workspace",
    });
  }
}
