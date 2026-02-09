import db from "../../database";
import { columnTable, projectTable } from "../../database/schema";

const DEFAULT_COLUMNS = [
  { name: "To Do", slug: "to-do", position: 0, isFinal: false },
  { name: "In Progress", slug: "in-progress", position: 1, isFinal: false },
  { name: "In Review", slug: "in-review", position: 2, isFinal: false },
  { name: "Done", slug: "done", position: 3, isFinal: true },
];

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

  if (createdProject) {
    for (const col of DEFAULT_COLUMNS) {
      await db.insert(columnTable).values({
        projectId: createdProject.id,
        name: col.name,
        slug: col.slug,
        position: col.position,
        isFinal: col.isFinal,
      });
    }
  }

  return createdProject;
}

export default createProject;
