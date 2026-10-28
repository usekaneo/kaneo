import type { QueryClient } from "@tanstack/react-query";
import { ADMIN_WORKSPACES_QUERY_KEY } from "@/hooks/queries/admin/use-admin-workspaces";
import { authClient } from "@/lib/auth-client";

/**
 * After an archive, restore, or delete: refresh the admin directory and the
 * administrator's own workspace switcher, which may include the workspace.
 */
export function refreshAfterWorkspaceLifecycle(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ADMIN_WORKSPACES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
  authClient.$store.notify("$listOrg");
}
