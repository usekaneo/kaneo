import {
  ALL_PROJECTS_ACCESS,
  type ProjectAccessValue,
} from "./project-access-value";

export function getInvitationProjectAccess(invitation: {
  projectAccess?: string | null;
  projectIds?: string[] | null;
}): ProjectAccessValue {
  return invitation.projectAccess === "selected"
    ? { projectAccess: "selected", projectIds: invitation.projectIds ?? [] }
    : ALL_PROJECTS_ACCESS;
}
