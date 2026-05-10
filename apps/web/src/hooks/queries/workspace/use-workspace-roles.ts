import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export type WorkspaceRole = {
  id: string;
  workspaceId: string;
  role: string;
  permission: Record<string, string[]>;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
};

function useWorkspaceRoles(workspaceId: string | undefined) {
  return useQuery<WorkspaceRole[]>({
    queryKey: ["workspace-roles", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];
      const result = await authClient.organization.listRoles({
        query: { organizationId: workspaceId },
      });
      if (result.error) throw new Error(result.error.message);
      const roles = (result.data ?? []) as Array<{
        id: string;
        organizationId: string;
        role: string;
        permission: string;
        createdAt: Date | string;
        updatedAt?: Date | string | null;
      }>;

      return roles.map((r) => ({
        id: r.id,
        workspaceId: r.organizationId,
        role: r.role,
        permission:
          typeof r.permission === "string"
            ? (JSON.parse(r.permission) as Record<string, string[]>)
            : (r.permission as unknown as Record<string, string[]>),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    },
  });
}

export default useWorkspaceRoles;
