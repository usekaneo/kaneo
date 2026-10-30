import { DEFAULT_ROLE_NAMES } from "@kaneo/permissions";
import { isWorkspaceOwnerRole } from "./is-workspace-owner-role";

export function getAssignableRoleOptions(
  roles: readonly string[] | undefined,
  currentRole?: string,
) {
  const options = [...(roles ?? DEFAULT_ROLE_NAMES)];
  if (
    currentRole &&
    !isWorkspaceOwnerRole(currentRole) &&
    !options.includes(currentRole)
  ) {
    options.push(currentRole);
  }
  return options;
}
