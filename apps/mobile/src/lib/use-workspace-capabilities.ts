import { useQuery } from "@tanstack/react-query";

import { api } from "./api/endpoints";
import { qk } from "./query";

export function useWorkspaceCapabilities(workspaceId: string) {
  return useQuery({
    queryKey: qk.capabilities(workspaceId),
    queryFn: () => api.workspaceCapabilities(workspaceId),
    enabled: !!workspaceId,
  });
}

// Cancellation has its own permission, absent from the named capabilities.
export function useCanCancelInvitations(workspaceId: string) {
  return useQuery({
    queryKey: qk.canCancelInvitations(workspaceId),
    queryFn: async () =>
      (await api.workspacePermission(workspaceId, { invitation: ["cancel"] }))
        .success,
    enabled: !!workspaceId,
  });
}
