import { APIError } from "better-auth/api";
import db from "../database";
import { replaceMemberProjectAccess } from "./member-project-access";
import { isOwnerRole } from "./project-access-mode";
import { resolveProjectAccessRequest } from "./resolve-project-access-request";

type InvitationProjectAccess = {
  organizationId: string;
  role?: string | null;
  projectAccess?: unknown;
  projectIds?: unknown;
};

export async function resolveInvitationProjectAccess(
  invitation: InvitationProjectAccess & { inviterId: string },
) {
  const resolution = await resolveProjectAccessRequest({
    workspaceId: invitation.organizationId,
    actorId: invitation.inviterId,
    targetRole: invitation.role,
    projectAccess: invitation.projectAccess,
    projectIds: invitation.projectIds,
  });

  if (!resolution.ok) {
    throw new APIError(
      resolution.status === 400 ? "BAD_REQUEST" : "FORBIDDEN",
      {
        message: resolution.message,
      },
    );
  }

  return resolution.access;
}

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
