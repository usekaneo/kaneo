import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import getTasks from "../../task/controllers/get-tasks";

export async function getPublicProject(id: string) {
  const [project] = await db
    .select({ isPublic: projectTable.isPublic })
    .from(projectTable)
    .where(eq(projectTable.id, id))
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

  const result = await getTasks(id);

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

  return result.data;
}
