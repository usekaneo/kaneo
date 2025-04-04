import db from "../../database";
import { projectTable } from "../../database/schema";

async function createProject(
  workspaceId: string,
  name: string,
  icon: string,
  slug: string,
) {
  const [createdProject] = await db
    .insert(projectTable)
    .values({
      workspaceId,
      name,
      icon,
      slug,
    })
    .returning();

  return createdProject;
}

export default createProject;
