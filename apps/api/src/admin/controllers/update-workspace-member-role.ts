import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";
import { isOwnerRole } from "../../project-access/is-owner-role";
import { isAssignableWorkspaceRole } from "../is-assignable-workspace-role";
import { lockWorkspace } from "../lock-workspace";
import listWorkspaceMembers from "./list-workspace-members";

async function updateWorkspaceMemberRole(request: {
  workspaceId: string;
  userId: string;
  role: string;
}) {
  const { workspaceId, userId, role } = request;

  await db.transaction(async (tx) => {
    const members = await lockWorkspace(tx, workspaceId);
    const member = members.find((candidate) => candidate.userId === userId);
    if (!member) {
      throw new HTTPException(404, { message: "Member not found" });
    }
    if (!(await isAssignableWorkspaceRole(tx, workspaceId, role))) {
      throw new HTTPException(400, {
        message:
          "Unknown role. Use the ownership transfer to make someone the owner",
      });
    }
    const owners = members.filter((candidate) => isOwnerRole(candidate.role));
    if (isOwnerRole(member.role) && owners.length === 1) {
      throw new HTTPException(409, {
        message:
          "Transfer ownership to another member before changing the only owner's role",
      });
    }

    await tx
      .update(workspaceUserTable)
      .set({ role })
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      );
  });

  return listWorkspaceMembers(workspaceId);
}

export default updateWorkspaceMemberRole;
