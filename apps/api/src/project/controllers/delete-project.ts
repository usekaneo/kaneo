import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { deleteS3Object } from "../../storage/s3";
import getProject from "./get-project";

async function deleteProject(id: string, workspaceId: string) {
  const existingProject = await getProject(id, workspaceId);

  const [deletedProject] = await db
    .delete(projectTable)
    .where(eq(projectTable.id, id))
    .returning();

  if (!deletedProject) {
    throw new HTTPException(500, {
      message: "Failed to delete project",
    });
  }

  if (deletedProject.backgroundObjectKey) {
    deleteS3Object(deletedProject.backgroundObjectKey).catch(() => {});
  }

  return existingProject;
}

export default deleteProject;
