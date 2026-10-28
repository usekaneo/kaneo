import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { workspaceIsActive } from "../../workspace/archive/active-workspace-sql";
import getTasks, {
  type GetTasksOptions,
} from "../../task/controllers/get-tasks";

export async function getPublicProject(
  id: string,
  options: GetTasksOptions = {},
) {
  const [project] = await db
    .select({ isPublic: projectTable.isPublic })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, id),
        // Public links of an archived workspace stop working until restored.
        workspaceIsActive(projectTable.workspaceId),
      ),
    )
    .limit(1);

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  if (!project.isPublic) {
    throw new HTTPException(403, {
      message: "Project is not public",
    });
  }

  const result = await getTasks(id, { ...options, publicOnly: true });

  if (!result.data) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  if (!result.data.isPublic) {
    throw new HTTPException(403, {
      message: "Project is not public",
    });
  }

  return { ...result.data, pagination: result.pagination };
}
