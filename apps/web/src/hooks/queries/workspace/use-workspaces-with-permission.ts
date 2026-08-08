import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { authClient } from "@/lib/auth-client";

// `useWorkspacePermission` can only answer for the active workspace — it pins
// `organizationId` to it. This asks the same server endpoint about a set of
// other workspaces instead, which is what the project move needs: both the
// source workspace the project actually lives in and the candidate targets.
//
// Pass a module-level constant for `permissions` so its identity is stable.
export function useWorkspacesWithPermission(
  workspaceIds: string[],
  permissions: Record<string, string[]>,
) {
  const ids = useMemo(() => [...workspaceIds].sort(), [workspaceIds]);
  const permissionKey = useMemo(
    () => JSON.stringify(permissions),
    [permissions],
  );

  const { data } = useQuery({
    queryKey: ["workspace-capabilities", "by-permission", permissionKey, ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const results = await Promise.all(
        ids.map(async (organizationId) => {
          try {
            const res = await authClient.organization.hasPermission({
              organizationId,
              permissions,
            });
            return res.data?.success === true ? organizationId : null;
          } catch (error) {
            console.error(
              `hasPermission check failed for workspace ${organizationId}:`,
              error,
            );
            return null;
          }
        }),
      );
      return results.filter((id): id is string => id !== null);
    },
  });

  return useMemo(() => new Set(data ?? []), [data]);
}
