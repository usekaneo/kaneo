import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, assetTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { getProjectSubtaskParentProjects } from "../../task/get-subtask-parent-projects";
import getProject from "./get-project";

async function deleteProject(id: string, workspaceId: string) {
  const existingProject = await getProject(id, workspaceId);

  const parents = await getProjectSubtaskParentProjects(id);

  const deletedProject = await db.transaction(async (tx) => {
    // Lock the owner before collecting keys so uploads cannot race the cascade.
    const [project] = await tx
      .select()
      .from(projectTable)
      .where(
        and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
      )
      .for("update");
    if (!project)
      throw new HTTPException(404, { message: "Project not found" });
    const assets = await tx
      .select({ objectKey: assetTable.objectKey })
      .from(assetTable)
      .where(eq(assetTable.projectId, id));
    await queueStorageCleanup(tx, [
      ...assets.map((asset) => asset.objectKey),
      ...(project.backgroundObjectKey ? [project.backgroundObjectKey] : []),
    ]);
    const [deleted] = await tx
      .delete(projectTable)
      .where(
        and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
      )
      .returning();
    return deleted;
  });
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
