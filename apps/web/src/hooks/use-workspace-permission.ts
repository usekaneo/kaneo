import { useMemo } from "react";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUser } from "@/hooks/queries/workspace-users/use-active-workspace-user";
import { authClient } from "@/lib/auth-client";

export type PermissionLevel = "owner" | "admin" | "member";

export function useWorkspacePermission() {
  const { data: activeWorkspace } = useActiveWorkspace();
  const { data: activeMember } = useGetActiveWorkspaceUser();

  const permissionCheckers = useMemo(
    () => ({
      // Server-side permission checking (most secure)
      async hasPermission(permissions: Record<string, string[]>) {
        try {
          const result = await authClient.organization.hasPermission({
            permissions,
          });
          return result.data || false;
        } catch (error) {
          console.error("Permission check failed:", error);
          return false;
        }
      },

      // Client-side role-based checking (faster for UI)
      checkRolePermission(permissions: Record<string, string[]>) {
        if (!activeMember?.role) return false;
        try {
          return authClient.organization.checkRolePermission({
            permissions,
            role: activeMember.role as PermissionLevel,
          });
        } catch (error) {
          console.error("Role permission check failed:", error);
          return false;
        }
      },

      // Convenience methods for common checks
      canManageProjects() {
        return this.checkRolePermission({
          project: ["create", "update", "delete"],
        });
      },

      canCreateProjects() {
        return this.checkRolePermission({ project: ["create"] });
      },

      canManageTasks() {
        return this.checkRolePermission({
          task: ["create", "update", "delete"],
        });
      },

      canAssignTasks() {
        return this.checkRolePermission({ task: ["assign"] });
      },

      canManageWorkspace() {
        return this.checkRolePermission({
          workspace: ["update", "manage_settings"],
        });
      },

      canDeleteWorkspace() {
        return this.checkRolePermission({ workspace: ["delete"] });
      },

      canInviteUsers() {
        return this.checkRolePermission({ team: ["invite"] });
      },

      canManageTeam() {
        return this.checkRolePermission({ team: ["remove", "manage_roles"] });
      },

      canRemoveMembers() {
        return this.checkRolePermission({ team: ["remove"] });
      },

      // Legacy compatibility method
      checkPermission(requiredRole: PermissionLevel = "member"): boolean {
        if (!activeWorkspace || !activeMember) return false;

        const userRole = activeMember.role as PermissionLevel;

        if (requiredRole === "owner") {
          return userRole === "owner";
        }

        if (requiredRole === "admin") {
          return ["owner", "admin"].includes(userRole);
        }

        // For member level, all roles have access
        return ["owner", "admin", "member"].includes(userRole);
      },

      isOwner: activeMember?.role === "owner",
      isAdmin: ["owner", "admin"].includes(activeMember?.role || ""),
      role: activeMember?.role as PermissionLevel | undefined,
    }),
    [activeMember, activeWorkspace],
  );

  return {
    ...permissionCheckers,
    workspace: activeWorkspace,
    member: activeMember,
  };
}
