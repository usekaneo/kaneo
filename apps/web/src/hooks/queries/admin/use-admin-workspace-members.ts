import { useQuery } from "@tanstack/react-query";
import { getAdminWorkspaceMembers } from "@/fetchers/admin/get-admin-workspace-members";

export type { AdminWorkspaceMember } from "@/fetchers/admin/workspace-types";

export function adminWorkspaceMembersQueryKey(workspaceId: string) {
  return ["admin", "workspace-members", workspaceId] as const;
}

function useAdminWorkspaceMembers(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: adminWorkspaceMembersQueryKey(workspaceId),
    queryFn: () => getAdminWorkspaceMembers(workspaceId),
    enabled: enabled && workspaceId !== "",
  });
}

export default useAdminWorkspaceMembers;
