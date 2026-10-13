import db from "../database";
import type { InvitationProjectAccess } from "./invitation-project-access-type";
import { isOwnerRole } from "./is-owner-role";
import { replaceMemberProjectAccess } from "./replace-member-project-access";

export async function applyInvitationProjectAccess(
  invitation: InvitationProjectAccess,
  userId: string,
) {
  const restricted =
    invitation.projectAccess === "selected" && !isOwnerRole(invitation.role);
  const projectIds = Array.isArray(invitation.projectIds)
    ? invitation.projectIds.filter((id): id is string => typeof id === "string")
    : [];

  await db.transaction((tx) =>
    replaceMemberProjectAccess(tx, {
      workspaceId: invitation.organizationId,
      userId,
      projectAccess: restricted ? "selected" : "all",
      projectIds,
    }),
  );
}
