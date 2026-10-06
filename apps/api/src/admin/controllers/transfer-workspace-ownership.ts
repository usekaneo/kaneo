import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { clearMemberProjectAccess } from "../../project-access/clear-member-project-access";
import { isOwnerRole } from "../../project-access/is-owner-role";
import { lockWorkspace } from "../lock-workspace";
import listWorkspaceMembers from "./list-workspace-members";

async function transferWorkspaceOwnership(request: {
  workspaceId: string;
  userId: string;
}) {
  const { workspaceId, userId } = request;

  await db.transaction(async (tx) => {
    const members = await lockWorkspace(tx, workspaceId);
    const target = members.find((candidate) => candidate.userId === userId);
    if (!target) {
      throw new HTTPException(404, { message: "Member not found" });
    }
    const otherOwners = members
      .filter((candidate) => isOwnerRole(candidate.role))
      .map((owner) => owner.userId)
      .filter((ownerId) => ownerId !== userId);
    if (isOwnerRole(target.role) && otherOwners.length === 0) {
      throw new HTTPException(400, {
        message: "This member is already the workspace owner",
      });
    }

    if (otherOwners.length > 0) {
      await tx
        .update(workspaceUserTable)
        .set({ role: "admin" })
        .where(
          and(
            eq(workspaceUserTable.workspaceId, workspaceId),
            inArray(workspaceUserTable.userId, otherOwners),
          ),
        );
    }
    await tx
      .update(workspaceUserTable)
      .set({ role: "owner" })
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      );
    await clearMemberProjectAccess(workspaceId, userId, tx);
  });

  await publishEvent("project_access.updated", { workspaceId, userId });
  return listWorkspaceMembers(workspaceId);
}

export default transferWorkspaceOwnership;
