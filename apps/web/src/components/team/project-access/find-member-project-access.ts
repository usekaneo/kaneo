import {
  ALL_PROJECTS_ACCESS,
  type ProjectAccessValue,
} from "./project-access-value";

export function findMemberProjectAccess(
  entries: readonly { userId: string; projectIds: string[] }[] | undefined,
  userId: string,
): ProjectAccessValue {
  const entry = entries?.find((candidate) => candidate.userId === userId);
  return entry
    ? { projectAccess: "selected", projectIds: entry.projectIds }
    : ALL_PROJECTS_ACCESS;
}
