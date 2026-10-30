import { useQuery } from "@tanstack/react-query";
import { getAdminWorkspaceRoles } from "@/fetchers/admin/get-admin-workspace-roles";

function useAdminWorkspaceRoles(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "workspace-roles", workspaceId],
    queryFn: () => getAdminWorkspaceRoles(workspaceId),
    enabled: enabled && workspaceId !== "",
  });
}

export default useAdminWorkspaceRoles;
