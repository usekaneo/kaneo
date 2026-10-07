import { APIError } from "better-auth/api";
import type { InvitationProjectAccess } from "./invitation-project-access-type";
import { resolveProjectAccessRequest } from "./resolve-project-access-request";

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
      { message: resolution.message },
    );
  }

  return resolution.access;
}
