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
    const status = resolution.status === 400 ? "BAD_REQUEST" : "FORBIDDEN";
    throw new APIError(status, { code: status, message: resolution.message });
  }

  return resolution.access;
}
