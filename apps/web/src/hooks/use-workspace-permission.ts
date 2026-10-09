import {
  WORKSPACE_CAPABILITY_NAMES,
  type WorkspaceCapability,
} from "@kaneo/permissions";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import getMyCapabilities from "@/fetchers/workspace/get-my-capabilities";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUser } from "@/hooks/queries/workspace-users/use-active-workspace-user";
import { authClient } from "@/lib/auth-client";

export type PermissionLevel = "owner" | "admin" | "member";

// Capabilities are named permission bundles (see `workspaceCapabilities` in
// @kaneo/permissions). The server evaluates all of them in one request with
// the same rules it enforces, so custom workspace roles work in the UI: the
// local `checkRolePermission` only knows the static roles compiled into the
// auth client.
type CapabilityMap = Record<WorkspaceCapability, boolean>;

function emptyCapabilityMap(): CapabilityMap {
  const out = {} as CapabilityMap;
  for (const key of WORKSPACE_CAPABILITY_NAMES) {
    out[key] = false;
  }
  return out;
}

export function useWorkspacePermission() {
  const { data: activeWorkspace } = useActiveWorkspace();
  const { data: activeMember } = useGetActiveWorkspaceUser();
  const workspaceId = activeWorkspace?.id;
  const role = activeMember?.role as string | undefined;

  // Cached by (workspaceId, role). Refetches when either changes, e.g., when
  // the admin edits the role's permissions in the Roles UI and we invalidate
  // this key.
  const {
    data: capabilities,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["workspace-capabilities", workspaceId, role],
    enabled: Boolean(workspaceId && role),
    staleTime: 5 * 60 * 1000,
    queryFn: (): Promise<CapabilityMap> =>
      getMyCapabilities(workspaceId as string),
  });

  const can: CapabilityMap = capabilities ?? emptyCapabilityMap();

  const helpers = useMemo(() => {
    return {
      canManageProjects: () => can.manageProjects,
      canCreateProjects: () => can.createProjects,
      canUpdateProjects: () => can.updateProjects,
      canShareProjects: () => can.shareProjects,
      canDeleteProjects: () => can.deleteProjects,
      canUpdateTasks: () => can.updateTasks,
      canCreateTasks: () => can.createTasks,
      canDeleteTasks: () => can.deleteTasks,
      canAssignTasks: () => can.assignTasks,
      canCreateLabels: () => can.createLabels,
      canUpdateLabels: () => can.updateLabels,
      canDeleteLabels: () => can.deleteLabels,
      canManageWorkspace: () => can.manageWorkspace,
      canManageSettings: () => can.manageSettings,
      canDeleteWorkspace: () => can.deleteWorkspace,
      canInviteUsers: () => can.inviteUsers,
      canManageTeam: () => can.manageTeam,
      canUpdateMembers: () => can.updateMembers,
      canRemoveMembers: () => can.removeMembers,
      // Escape hatch for ad-hoc permission checks (uncached). Prefer adding
      // a capability above.
      hasPermission: async (permissions: Record<string, string[]>) => {
        try {
          const res = await authClient.organization.hasPermission({
            organizationId: workspaceId,
            permissions,
          });
          return res.data?.success === true;
        } catch (error) {
          console.error("hasPermission check failed:", error);
          return false;
        }
      },
    };
  }, [can, workspaceId]);

  return {
    ...helpers,
    workspace: activeWorkspace,
    member: activeMember,
    role,
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "admin",
    // True while the first capability fetch is in flight. Useful for hiding
    // action UI during the initial render instead of flashing it on then
    // off when the server check resolves.
    isCheckingPermissions:
      Boolean(workspaceId && role) && (isLoading || !capabilities),
    isRefetchingPermissions: isFetching,
  };
}
