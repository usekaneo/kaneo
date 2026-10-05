import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { publishEvent } from "../../events";
import { keepHiddenGrants } from "../../project-access/keep-hidden-grants";
import { lockAccessChange } from "../../project-access/lock-access-change";
import { replaceMemberProjectAccess } from "../../project-access/replace-member-project-access";
import type { ProjectAccessMode } from "../../project-access/project-access-mode";
import { resolveProjectAccessRequest } from "../../project-access/resolve-project-access-request";
import { unassignInaccessibleTasks } from "../../project-access/unassign-inaccessible-tasks";

async function updateMemberProjectAccess(request: {
  workspaceId: string;
  actorId: string;
  userId: string;
  projectAccess: ProjectAccessMode;
  projectIds: string[];
}) {
  const { workspaceId, actorId, userId } = request;

  if (actorId === userId) {
    throw new HTTPException(403, {
      message: "You can't change your own project access",
    });
  }

  const [member] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);

  if (!member) {
    throw new HTTPException(404, { message: "Member not found" });
  }

  const resolution = await resolveProjectAccessRequest({
    workspaceId,
    actorId,
    targetRole: member.role,
    projectAccess: request.projectAccess,
    projectIds: request.projectIds,
  });

  if (!resolution.ok) {
    throw new HTTPException(resolution.status, {
      message: resolution.message,
    });
  }

  const unassigned = await db.transaction(async (tx) => {
    const lock = await lockAccessChange(tx, { workspaceId, actorId, userId });
    if (!lock.actorAllowed) {
      throw new HTTPException(403, {
        message: "You don't have access to this workspace",
      });
    }
    if (!lock.targetIsMember) {
      throw new HTTPException(404, { message: "Member not found" });
    }

    const outcome = await keepHiddenGrants({
      workspaceId,
      actorId,
      userId,
      access: resolution.access,
      database: tx,
    });
    if (!outcome.ok) {
      throw new HTTPException(403, { message: outcome.message });
    }

    await replaceMemberProjectAccess(tx, {
      workspaceId,
      userId,
      ...outcome.access,
    });
    return unassignInaccessibleTasks(tx, { workspaceId, userId, actorId });
  });

  await publishEvent("project_access.updated", { workspaceId, userId });
  for (const projectId of new Set(unassigned.map((task) => task.projectId))) {
    await publishEvent("task.bulk_unassigned", { projectId, userId: actorId });
  }

  return { userId, ...resolution.access };
}

export default updateMemberProjectAccess;
