import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { auditLogTable, projectTable } from "../../database/schema";
import { assertWorkspaceRole } from "../../utils/assert-workspace-role";

async function unarchiveProject(options: {
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

  if (!existingProject.archivedAt) {
    return existingProject;
  }

  const [unarchivedProject] = await db
    .update(projectTable)
    .set({ archivedAt: null, archivedBy: null })
    .where(
      and(
        eq(projectTable.id, options.projectId),
        eq(projectTable.workspaceId, options.workspaceId),
      ),
    )
    .returning();

  if (!unarchivedProject) {
    throw new HTTPException(500, { message: "Failed to unarchive project" });
  }

  await db.insert(auditLogTable).values({
    workspaceId: options.workspaceId,
    actorId: options.actorId,
    action: "project.unarchived",
    resourceType: "project",
    resourceId: options.projectId,
  });

  return unarchivedProject;
}

export default unarchiveProject;
