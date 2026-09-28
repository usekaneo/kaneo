import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { authClient } from "@/lib/auth-client";

// `useWorkspacePermission` can only answer for the active workspace — it pins
// `organizationId` to it. This asks the same server endpoint about a set of
// other workspaces instead, which is what the project move needs: both the
// source workspace the project actually lives in and the candidate targets.
//
// Pass a module-level constant for `permissions` so its identity is stable.
// Several actions on the same workspace belong in one call: the endpoint
// requires all of them, and asking separately doubles the round-trips.
export function useWorkspacesWithPermission(
  workspaceIds: string[],
  permissions: Record<string, string[]>,
) {
  const ids = useMemo(() => [...workspaceIds].sort(), [workspaceIds]);
  const permissionKey = useMemo(
    () => JSON.stringify(permissions),
    [permissions],
  );

  const { data, isPending, isError } = useQuery({
    queryKey: ["workspace-capabilities", "by-permission", permissionKey, ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Deliberately not caught per workspace: swallowing a failed check as
      // "no permission" is indistinguishable from a real denial, so a
      // transient error would silently hide the action instead of retrying.
      const results = await Promise.all(
        ids.map(async (organizationId) => {
          const res = await authClient.organization.hasPermission({
            organizationId,
            permissions,
          });
          if (res.error) throw new Error(res.error.message);
          return res.data?.success === true ? organizationId : null;
        }),
      );
      return results.filter((id): id is string => id !== null);
    },
  });

  const allowed = useMemo(() => new Set(data ?? []), [data]);

  return {
    allowed,
    // False while disabled, so callers don't read an empty set as "loading".
    isPending: ids.length > 0 && isPending,
    isError,
  };
}
