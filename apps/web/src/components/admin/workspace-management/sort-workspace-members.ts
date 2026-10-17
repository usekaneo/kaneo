import { isWorkspaceOwnerRole } from "./is-workspace-owner-role";

export function sortWorkspaceMembers<Member extends { role: string }>(
  members: readonly Member[],
) {
  return [...members].sort(
    (a, b) =>
      Number(isWorkspaceOwnerRole(b.role)) -
      Number(isWorkspaceOwnerRole(a.role)),
  );
}
