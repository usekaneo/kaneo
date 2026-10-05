export type ProjectAccessMode = "all" | "selected";

export type ProjectAccessValue = {
  projectAccess: ProjectAccessMode;
  projectIds: string[];
};

export const ALL_PROJECTS_ACCESS: ProjectAccessValue = {
  projectAccess: "all",
  projectIds: [],
};

export function toggleProjectId(
  projectIds: string[],
  projectId: string,
  checked: boolean,
): string[] {
  const rest = projectIds.filter((id) => id !== projectId);
  return checked ? [...rest, projectId] : rest;
}

export function findMemberProjectAccess(
  entries: readonly { userId: string; projectIds: string[] }[] | undefined,
  userId: string,
): ProjectAccessValue {
  const entry = entries?.find((candidate) => candidate.userId === userId);
  return entry
    ? { projectAccess: "selected", projectIds: entry.projectIds }
    : ALL_PROJECTS_ACCESS;
}

export function getInvitationProjectAccess(invitation: {
  projectAccess?: string | null;
  projectIds?: string[] | null;
}): ProjectAccessValue {
  return invitation.projectAccess === "selected"
    ? { projectAccess: "selected", projectIds: invitation.projectIds ?? [] }
    : ALL_PROJECTS_ACCESS;
}

export function toProjectAccessRequest(
  value: ProjectAccessValue,
  availableProjectIds: readonly string[],
): ProjectAccessValue {
  if (value.projectAccess === "all") return ALL_PROJECTS_ACCESS;
  const available = new Set(availableProjectIds);
  return {
    projectAccess: "selected",
    projectIds: [...new Set(value.projectIds)].filter((id) =>
      available.has(id),
    ),
  };
}

export function isProjectAccessComplete(value: ProjectAccessValue): boolean {
  return value.projectAccess === "all" || value.projectIds.length > 0;
}
