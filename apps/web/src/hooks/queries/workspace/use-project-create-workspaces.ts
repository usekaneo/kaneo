import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { authClient } from "@/lib/auth-client";

// `useWorkspacePermission` can only answer for the active workspace — it pins
// `organizationId` to it. This asks the same server endpoint about a set of
// other workspaces instead, which is what picking a move target needs.
function useProjectCreateWorkspaces(workspaceIds: string[]) {
  const ids = useMemo(() => [...workspaceIds].sort(), [workspaceIds]);

  const { data } = useQuery({
    queryKey: ["workspace-capabilities", "project-create", ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const results = await Promise.all(
        ids.map(async (organizationId) => {
          try {
            const res = await authClient.organization.hasPermission({
              organizationId,
              permissions: { project: ["create"] },
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

export default useProjectCreateWorkspaces;
