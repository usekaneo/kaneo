import { useMutation, useQueryClient } from "@tanstack/react-query";
import createGenericWebhookIntegration, {
  type CreateGenericWebhookIntegrationRequest,
} from "@/fetchers/generic-webhook-integration/create-generic-webhook-integration";
import deleteGenericWebhookIntegration from "@/fetchers/generic-webhook-integration/delete-generic-webhook-integration";
import updateGenericWebhookIntegration, {
  type UpdateGenericWebhookIntegrationRequest,
} from "@/fetchers/generic-webhook-integration/update-generic-webhook-integration";

export function useCreateGenericWebhookIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateGenericWebhookIntegrationRequest;
    }) => createGenericWebhookIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["generic-webhook-integration", projectId],
      });
    },
  });
}

export function useUpdateGenericWebhookIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateGenericWebhookIntegrationRequest;
    }) => updateGenericWebhookIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["generic-webhook-integration", projectId],
      });
    },
  });
}

export function useDeleteGenericWebhookIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) =>
      deleteGenericWebhookIntegration(projectId),
    onSuccess: (_, projectId) => {
      void queryClient.invalidateQueries({
        queryKey: ["generic-webhook-integration", projectId],
      });
    },
  });
}
