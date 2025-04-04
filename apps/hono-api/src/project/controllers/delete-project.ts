import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function deleteProject(id: string) {
  const [existingProject] = await db
    .select()
    .from(projectTable)
    .where(eq(projectTable.id, id));

  const isProjectExisting = Boolean(existingProject);

  if (!isProjectExisting) {
    throw new HTTPException(404, {
      message: "Project doesn't exist",
    });
  }

  const [deletedProject] = await db
    .delete(projectTable)
    .where(eq(projectTable.id, id))
    .returning();

  return deletedProject;
}

export default deleteProject;
