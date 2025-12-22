import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { auditLogTable, projectTable } from "../../database/schema";
import { assertWorkspaceRole } from "../../utils/assert-workspace-role";

async function archiveProject(options: {
  projectId: string;
  workspaceId: string;
  actorId: string;
}) {
  await assertWorkspaceRole({
    workspaceId: options.workspaceId,
    userId: options.actorId,
    allowedRoles: ["owner", "admin"],
  });

  const [existingProject] = await db
    .select()
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, options.projectId),
        eq(projectTable.workspaceId, options.workspaceId),
      ),
    )
    .limit(1);

  if (!existingProject) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  if (existingProject.archivedAt) {
    return existingProject;
  }

  const [archivedProject] = await db
    .update(projectTable)
    .set({ archivedAt: new Date(), archivedBy: options.actorId })
    .where(
      and(
        eq(projectTable.id, options.projectId),
        eq(projectTable.workspaceId, options.workspaceId),
      ),
    )
    .returning();

  if (!archivedProject) {
    throw new HTTPException(500, { message: "Failed to archive project" });
  }

  await db.insert(auditLogTable).values({
    workspaceId: options.workspaceId,
    actorId: options.actorId,
    action: "project.archived",
    resourceType: "project",
    resourceId: options.projectId,
  });

  return archivedProject;
}

export default archiveProject;
