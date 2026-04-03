import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTelegramIntegration, {
  type CreateTelegramIntegrationRequest,
} from "@/fetchers/telegram-integration/create-telegram-integration";
import deleteTelegramIntegration from "@/fetchers/telegram-integration/delete-telegram-integration";
import updateTelegramIntegration, {
  type UpdateTelegramIntegrationRequest,
} from "@/fetchers/telegram-integration/update-telegram-integration";

export function useCreateTelegramIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateTelegramIntegrationRequest;
    }) => createTelegramIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["telegram-integration", projectId],
      });
    },
  });
}

export function useUpdateTelegramIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateTelegramIntegrationRequest;
    }) => updateTelegramIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["telegram-integration", projectId],
      });
    },
  });
}

export function useDeleteTelegramIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteTelegramIntegration(projectId),
    onSuccess: (_, projectId) => {
      void queryClient.invalidateQueries({
        queryKey: ["telegram-integration", projectId],
      });
    },
  });
}
