import { findInaccessibleProjectIds } from "./find-inaccessible-project-ids";

type InvitationWithProjects = { projectIds: string[] };

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
  const hidden = new Set(
    await findInaccessibleProjectIds(
      viewerId,
      restricted.flatMap((invitation) => invitation.projectIds),
    ),
  );
  if (hidden.size === 0) return;
  for (const invitation of restricted) {
    invitation.projectIds = invitation.projectIds.filter(
      (projectId) => !hidden.has(projectId),
    );
  }
}
