import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  createClientPartner,
  deleteClientPartner,
  getClient,
  getClients,
  lookupCnpj,
  updateClient,
} from "@/fetchers/client/client-api";

export function useClients(workspaceId: string) {
  return useQuery({
    queryKey: ["clients", workspaceId],
    queryFn: () => getClients(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useClient(clientId: string, workspaceId: string) {
  return useQuery({
    queryKey: ["client", clientId, workspaceId],
    queryFn: () => getClient(clientId, workspaceId),
    enabled: Boolean(clientId && workspaceId),
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
      void queryClient.invalidateQueries({
        queryKey: ["client", variables.id, variables.workspaceId],
      });
    },
  });
}

export function useLookupCnpj() {
  return useMutation({
    mutationFn: ({
      workspaceId,
      cnpj,
    }: {
      workspaceId: string;
      cnpj: string;
    }) => lookupCnpj(workspaceId, cnpj),
  });
}

export function useCreateClientPartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId,
      ...input
    }: Parameters<typeof createClientPartner>[1] & { clientId: string }) =>
      createClientPartner(clientId, input),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["client", variables.clientId, variables.workspaceId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["clients", variables.workspaceId],
      });
    },
  });
}

export function useDeleteClientPartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId,
      partnerId,
      workspaceId,
    }: {
      clientId: string;
      partnerId: string;
      workspaceId: string;
    }) => deleteClientPartner(clientId, partnerId, workspaceId),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["client", variables.clientId, variables.workspaceId],
      });
    },
  });
}
