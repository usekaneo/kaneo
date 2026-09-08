import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { getProjectSubtaskParentProjects } from "../../task/get-subtask-parent-projects";
import getProject from "./get-project";

async function deleteProject(id: string, workspaceId: string) {
  const existingProject = await getProject(id, workspaceId);

  const parents = await getProjectSubtaskParentProjects(id);

  const [deletedProject] = await db
    .delete(projectTable)
    .where(eq(projectTable.id, id))
    .returning();

  if (!deletedProject) {
    throw new HTTPException(500, {
      message: "Failed to delete project",
    });
  }

  await publishEvent("subtask-parents.refresh", {
    projects: parents.filter((parent) => parent.projectId !== id),
  });

  return existingProject;
}

export default deleteProject;
