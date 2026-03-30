import { useMutation, useQueryClient } from "@tanstack/react-query";
import createDiscordIntegration, {
  type CreateDiscordIntegrationRequest,
} from "@/fetchers/discord-integration/create-discord-integration";
import deleteDiscordIntegration from "@/fetchers/discord-integration/delete-discord-integration";
import updateDiscordIntegration, {
  type UpdateDiscordIntegrationRequest,
} from "@/fetchers/discord-integration/update-discord-integration";

export function useCreateDiscordIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateDiscordIntegrationRequest;
    }) => createDiscordIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["discord-integration", projectId],
      });
    },
  });
}

export function useUpdateDiscordIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateDiscordIntegrationRequest;
    }) => updateDiscordIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["discord-integration", projectId],
      });
    },
  });
}

export function useDeleteDiscordIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteDiscordIntegration(projectId),
    onSuccess: (_, projectId) => {
      void queryClient.invalidateQueries({
        queryKey: ["discord-integration", projectId],
      });
    },
  });
}
