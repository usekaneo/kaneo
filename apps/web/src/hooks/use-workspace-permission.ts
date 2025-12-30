import { useMemo } from "react";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUser } from "@/hooks/queries/workspace-users/use-active-workspace-user";
import { authClient } from "@/lib/auth-client";

export type PermissionLevel = "owner" | "admin" | "member";

export function useWorkspacePermission() {
  const { data: activeWorkspace } = useActiveWorkspace();
  const { data: activeMember } = useGetActiveWorkspaceUser();

  const permissionCheckers = useMemo(() => {
    const role = activeMember?.role as PermissionLevel | undefined;

    const hasPermission = async (permissions: Record<string, string[]>) => {
      try {
        const result = await authClient.organization.hasPermission({
          permissions,
        });
        return result.data || false;
      } catch (error) {
        console.error("Permission check failed:", error);
        return false;
      }
    };

    const checkRolePermission = (permissions: Record<string, string[]>) => {
      if (!role) return false;
      try {
        return authClient.organization.checkRolePermission({
          permissions,
          role,
        });
      } catch (error) {
        console.error("Role permission check failed:", error);
        return false;
      }
    };

    const checkPermission = (requiredRole: PermissionLevel = "member") => {
      if (!activeWorkspace || !activeMember) return false;

      const userRole = activeMember.role as PermissionLevel;

      if (requiredRole === "owner") {
        return userRole === "owner";
      }

      if (requiredRole === "admin") {
        return ["owner", "admin"].includes(userRole);
      }

      return ["owner", "admin", "member"].includes(userRole);
    };

    return {
      hasPermission,
      checkRolePermission,
      canManageProjects: () =>
        checkRolePermission({ project: ["create", "update", "delete"] }),
      canCreateProjects: () => checkRolePermission({ project: ["create"] }),
      canManageTasks: () =>
        checkRolePermission({ task: ["create", "update", "delete"] }),
      canAssignTasks: () => checkRolePermission({ task: ["assign"] }),
      canManageWorkspace: () =>
        checkRolePermission({ workspace: ["update", "manage_settings"] }),
      canDeleteWorkspace: () => checkRolePermission({ workspace: ["delete"] }),
      canInviteUsers: () => checkRolePermission({ team: ["invite"] }),
      canManageTeam: () =>
        checkRolePermission({ team: ["remove", "manage_roles"] }),
      canRemoveMembers: () => checkRolePermission({ team: ["remove"] }),
      checkPermission,
      isOwner: role === "owner",
      isAdmin: ["owner", "admin"].includes(role || ""),
      role,
    };
  }, [activeMember, activeWorkspace]);

  return {
    ...permissionCheckers,
    workspace: activeWorkspace,
    member: activeMember,
  };
}
