import { findAccessibleProjects } from "./find-accessible-projects";

type InvitationWithProjects = {
  organizationId?: unknown;
  projectIds: string[];
};

function hasProjectIds(value: unknown): value is InvitationWithProjects {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { projectIds?: unknown }).projectIds)
  );
}

export async function hideInaccessibleInvitationProjects(
  viewerId: string,
  invitations: unknown,
): Promise<void> {
  if (!Array.isArray(invitations)) return;
  const restricted = invitations.filter(hasProjectIds);
  const visible = await findAccessibleProjects(
    viewerId,
    restricted.flatMap((invitation) => invitation.projectIds),
  );
  for (const invitation of restricted) {
    invitation.projectIds = invitation.projectIds.filter(
      (projectId) => visible.get(projectId) === invitation.organizationId,
    );
  }
}
