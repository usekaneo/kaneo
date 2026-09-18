import { client } from "@kaneo/libs";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUser } from "@/hooks/queries/workspace-users/use-active-workspace-user";
import { authClient } from "@/lib/auth-client";

export type PermissionLevel = "owner" | "admin" | "member";

// Capabilities are named permission bundles checked against what the SERVER
// resolves for the caller (custom roles included), fetched once per
// workspace and role rather than one request per capability.
const CAPABILITIES = {
  manageProjects: { project: ["create", "update", "delete"] },
  createProjects: { project: ["create"] },
  updateProjects: { project: ["update"] },
  deleteProjects: { project: ["delete"] },
  updateTasks: { task: ["update"] },
  createTasks: { task: ["create"] },
  deleteTasks: { task: ["delete"] },
  assignTasks: { task: ["assign"] },
  createLabels: { label: ["create"] },
  updateLabels: { label: ["update"] },
  deleteLabels: { label: ["delete"] },
  manageWorkspace: { workspace: ["update", "manage_settings"] },
  deleteWorkspace: { workspace: ["delete"] },
  inviteUsers: { invitation: ["create"] },
  manageTeam: { member: ["update", "delete"] },
  removeMembers: { member: ["delete"] },
  seeEveryonesTime: { timeEntry: ["read_all"] },
  manageEveryonesTime: { timeEntry: ["manage_all"] },
  seePeople: { people: ["read_all"] },
  managePeople: { people: ["manage"] },
  seeActivity: { activity: ["read_all"] },
  approveRequests: { request: ["approve"] },
  seePay: { payroll: ["read"] },
  managePay: { payroll: ["manage"] },
  readAudit: { audit: ["read"] },
  uploadFiles: { file: ["upload"] },
  manageFiles: { file: ["manage"] },
} as const satisfies Record<string, Record<string, string[]>>;

type Capability = keyof typeof CAPABILITIES;

type CapabilityMap = Record<Capability, boolean>;

function emptyCapabilityMap(): CapabilityMap {
  const out = {} as CapabilityMap;
  for (const key of Object.keys(CAPABILITIES) as Capability[]) {
    out[key] = false;
  }
  return out;
}

export function useWorkspacePermission() {
  const { data: activeWorkspace } = useActiveWorkspace();
  const { data: activeMember } = useGetActiveWorkspaceUser();
  const workspaceId = activeWorkspace?.id;
  const role = activeMember?.role as string | undefined;

  // One query that fans out to all capability checks in parallel and caches
  // the resulting map by (workspaceId, role). Refetches when either changes,
  // e.g., when the admin edits the role's permissions in the Roles UI and
  // we invalidate this key.
  const {
    data: capabilities,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["workspace-capabilities", workspaceId, role],
    enabled: Boolean(workspaceId && role),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CapabilityMap> => {
      const map = emptyCapabilityMap();
      const response = await client.workspace[":workspaceId"].permissions.$get({
        param: { workspaceId: workspaceId as string },
      });
      if (!response.ok) {
        console.error("Failed to load workspace permissions");
        return map;
      }
      const granted: Record<string, string[]> = await response.json();
      for (const [key, permissions] of Object.entries(CAPABILITIES) as Array<
        [Capability, Record<string, readonly string[]>]
      >) {
        map[key] = Object.entries(permissions).every(([resource, actions]) =>
          actions.every((action) => granted[resource]?.includes(action)),
        );
      }
      return map;
    },
  });

  const can: CapabilityMap = capabilities ?? emptyCapabilityMap();

  const helpers = useMemo(() => {
    return {
      canManageProjects: () => can.manageProjects,
      canCreateProjects: () => can.createProjects,
      canUpdateProjects: () => can.updateProjects,
      canDeleteProjects: () => can.deleteProjects,
      canUpdateTasks: () => can.updateTasks,
      canCreateTasks: () => can.createTasks,
      canDeleteTasks: () => can.deleteTasks,
      canAssignTasks: () => can.assignTasks,
      canCreateLabels: () => can.createLabels,
      canUpdateLabels: () => can.updateLabels,
      canDeleteLabels: () => can.deleteLabels,
      canManageWorkspace: () => can.manageWorkspace,
      canDeleteWorkspace: () => can.deleteWorkspace,
      canInviteUsers: () => can.inviteUsers,
      canManageTeam: () => can.manageTeam,
      canRemoveMembers: () => can.removeMembers,
      canSeeEveryonesTime: () => can.seeEveryonesTime,
      canManageEveryonesTime: () => can.manageEveryonesTime,
      canSeePeople: () => can.seePeople,
      canManagePeople: () => can.managePeople,
      canSeeActivity: () => can.seeActivity,
      canApproveRequests: () => can.approveRequests,
      canSeePay: () => can.seePay,
      canManagePay: () => can.managePay,
      canReadAudit: () => can.readAudit,
      canUploadFiles: () => can.uploadFiles,
      canManageFiles: () => can.manageFiles,
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
