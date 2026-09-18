import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPairingCode, revokeDevice } from "@/fetchers/agent";

export function useCreatePairingCode(workspaceId: string) {
  return useMutation({
    mutationFn: () => createPairingCode(workspaceId),
  });
}

export function useRevokeDevice(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeDevice(workspaceId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["agent-devices", workspaceId],
      }),
  });
}
