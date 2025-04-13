import { eq } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function deleteProject(id: string) {
  const [existingProject] = await db
    .select()
    .from(projectTable)
    .where(eq(projectTable.id, id));

  const isProjectExisting = Boolean(existingProject);

  if (!isProjectExisting) {
    throw new Error("Project doesn't exist");
  }

  const [deletedProject] = await db
    .delete(projectTable)
    .where(eq(projectTable.id, id))
    .returning();

  return deletedProject;
}

export default deleteProject;
