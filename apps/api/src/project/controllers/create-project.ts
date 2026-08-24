import db from "../../database";
import { columnTable, projectTable } from "../../database/schema";
import {
  DEFAULT_PROJECT_COLUMNS,
  getProjectTypeTemplate,
} from "../project-types";

export { DEFAULT_PROJECT_COLUMNS };

async function createProject(
  workspaceId: string,
  name: string,
  icon: string,
  slug: string,
  clientId?: string | null,
  projectType?: string | null,
) {
  const template = getProjectTypeTemplate(projectType);

  return db.transaction(async (tx) => {
    const [createdProject] = await tx
      .insert(projectTable)
      .values({
        workspaceId,
        name,
        icon,
        slug,
        clientId: clientId || null,
        projectType: template.key,
      })
      .returning();

    if (createdProject) {
      for (const col of template.columns) {
        await tx.insert(columnTable).values({
          projectId: createdProject.id,
          name: col.name,
          slug: col.slug,
          position: col.position,
          isFinal: col.isFinal,
        });
      }
    }

    return createdProject;
  });
}

export default createProject;
