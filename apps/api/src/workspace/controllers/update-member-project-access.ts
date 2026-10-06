import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { publishEvent } from "../../events";
import { keepHiddenGrants } from "../../project-access/keep-hidden-grants";
import { listAccessibleProjectIds } from "../../project-access/list-accessible-project-ids";
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

  const { access, changedProjectIds, unassigned } = await db.transaction(
    async (tx) => {
      const lock = await lockAccessChange(tx, { workspaceId, actorId, userId });
      if (!lock.actorAllowed) {
        throw new HTTPException(403, { message: "Insufficient permissions" });
      }
      if (lock.targetRole === null) {
        throw new HTTPException(404, { message: "Member not found" });
      }

      const resolution = await resolveProjectAccessRequest({
        workspaceId,
        actorId,
        targetRole: lock.targetRole,
        projectAccess: request.projectAccess,
        projectIds: request.projectIds,
        database: tx,
      });
      if (!resolution.ok) {
        throw new HTTPException(resolution.status, {
          message: resolution.message,
        });
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

      const before = await listAccessibleProjectIds(tx, workspaceId, userId);
      await replaceMemberProjectAccess(tx, {
        workspaceId,
        userId,
        ...outcome.access,
      });
      const after = await listAccessibleProjectIds(tx, workspaceId, userId);
      return {
        access: resolution.access,
        changedProjectIds: [
          ...[...before].filter((projectId) => !after.has(projectId)),
          ...[...after].filter((projectId) => !before.has(projectId)),
        ],
        unassigned: await unassignInaccessibleTasks(tx, {
          workspaceId,
          userId,
          actorId,
        }),
      };
    },
  );

  await publishEvent("project_access.updated", {
    workspaceId,
    userId,
    projectIds: changedProjectIds,
  });
  for (const projectId of new Set(unassigned.map((task) => task.projectId))) {
    await publishEvent("task.bulk_unassigned", { projectId, userId: actorId });
  }

  return { userId, ...access };
}

export default updateMemberProjectAccess;
