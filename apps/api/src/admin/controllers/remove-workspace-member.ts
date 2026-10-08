import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";
import { isOwnerRole } from "../../project-access/is-owner-role";
import { handleMemberRemoved } from "../../workspace-members/handle-member-removed";
import { lockWorkspace } from "../lock-workspace";
import listWorkspaceMembers from "./list-workspace-members";

async function removeWorkspaceMember(request: {
  workspaceId: string;
  userId: string;
}) {
  const { workspaceId, userId } = request;

  await db.transaction(async (tx) => {
    const members = await lockWorkspace(tx, workspaceId);
    const member = members.find((candidate) => candidate.userId === userId);
    if (!member) {
      throw new HTTPException(404, { message: "Member not found" });
    }
    const owners = members.filter((candidate) => isOwnerRole(candidate.role));
    if (isOwnerRole(member.role) && owners.length === 1) {
      throw new HTTPException(409, {
        message:
          "Transfer ownership to another member before removing the only owner",
      });
    }

    await tx
      .delete(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      );
  });

  const [user] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  await handleMemberRemoved({ workspaceId, userId, userRole: user?.role });
  return listWorkspaceMembers(workspaceId);
}

export default removeWorkspaceMember;
