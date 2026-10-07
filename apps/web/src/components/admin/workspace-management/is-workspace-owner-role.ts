export function isWorkspaceOwnerRole(role: string) {
  return role.split(",").includes("owner");
}
