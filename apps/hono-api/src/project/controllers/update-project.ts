import { eq } from "drizzle-orm";
import db from "../../../database";
import { projectTable } from "../../../database/schema";

async function updateProject(
  id: string,
  name: string,
  icon: string,
  slug: string,
) {
  const [existingProject] = await db
    .select()
    .from(projectTable)
    .where(eq(projectTable.id, id));

  const isProjectExisting = Boolean(existingProject);

  if (!isProjectExisting) {
    throw new Error("Project doesn't exist");
  }

  const [updatedWorkspace] = await db
    .update(projectTable)
    .set({
      name,
      icon,
      slug,
    })
    .where(eq(projectTable.id, id))
    .returning();

  return updatedWorkspace;
}

export default updateProject;
