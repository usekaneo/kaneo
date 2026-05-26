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

function parsePermission(raw: unknown): Record<string, string[]> {
  if (raw && typeof raw === "object") {
    return raw as Record<string, string[]>;
  }
  if (typeof raw !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string[]>;
    }
    return {};
  } catch {
    return {};
  }
}

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
        permission: parsePermission(r.permission),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    },
  });
}

export default useWorkspaceRoles;
