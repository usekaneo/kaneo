import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  getClients,
  updateClient,
} from "@/fetchers/client/client-api";

export function useClients(workspaceId: string) {
  return useQuery({
    queryKey: ["clients", workspaceId],
    queryFn: () => getClients(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClient,
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["clients", variables.workspaceId],
      });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: Parameters<typeof updateClient>[1] & { id: string }) =>
      updateClient(id, input),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["clients", variables.workspaceId],
      });
    },
  });
}
