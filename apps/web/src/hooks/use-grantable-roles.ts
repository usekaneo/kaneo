import {
  type BuiltInRoleName,
  builtInRoles,
  coversPermissions,
  DEFAULT_ROLE_NAMES,
} from "@kaneo/permissions";
import { useMemo } from "react";
import useWorkspaceRoles from "@/hooks/queries/workspace/use-workspace-roles";
import { useGetActiveWorkspaceUser } from "@/hooks/queries/workspace-users/use-active-workspace-user";

type Statements = Record<string, readonly string[]>;

// Roles the current member may hand out when inviting or changing a role.
// Mirrors the API's canGrantRole so the picker never offers a role the
// server would reject. Owner is never offered: ownership changes need a
// dedicated transfer flow.
function useGrantableRoles(workspaceId: string | undefined) {
  const { data: activeMember } = useGetActiveWorkspaceUser();
  const { data: roles = [], isLoading } = useWorkspaceRoles(workspaceId);

  const grantable = useMemo(() => {
    const statementsFor = (role: string): Statements | null =>
      roles.find((r) => r.role === role)?.permission ??
      (role in builtInRoles
        ? builtInRoles[role as BuiltInRoleName].statements
        : null);

    const ownRoles = (activeMember?.role ?? "")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    const isOwner = ownRoles.includes("owner");
    const own = ownRoles
      .map(statementsFor)
      .filter((s): s is Statements => s !== null);

    const names = [
      ...DEFAULT_ROLE_NAMES,
      ...roles
        .map((r) => r.role)
        .filter(
          (name) =>
            name !== "owner" &&
            !(DEFAULT_ROLE_NAMES as readonly string[]).includes(name),
        ),
    ];

    return names.filter((name) => {
      if (isOwner) return true;
      const target = statementsFor(name);
      return target !== null && coversPermissions(own, [target]);
    });
  }, [activeMember?.role, roles]);

  return { roles: grantable, isLoading };
}

export default useGrantableRoles;
