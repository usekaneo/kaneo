import { useMutation, useQueryClient } from "@tanstack/react-query";
import createSlackIntegration, {
  type CreateSlackIntegrationRequest,
} from "@/fetchers/slack-integration/create-slack-integration";
import deleteSlackIntegration from "@/fetchers/slack-integration/delete-slack-integration";
import updateSlackIntegration, {
  type UpdateSlackIntegrationRequest,
} from "@/fetchers/slack-integration/update-slack-integration";

export function useCreateSlackIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateSlackIntegrationRequest;
    }) => createSlackIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["slack-integration", projectId],
      });
    },
  });
}

export function useUpdateSlackIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateSlackIntegrationRequest;
    }) => updateSlackIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["slack-integration", projectId],
      });
    },
  });
}

export function useDeleteSlackIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteSlackIntegration(projectId),
    onSuccess: (_, projectId) => {
      void queryClient.invalidateQueries({
        queryKey: ["slack-integration", projectId],
      });
    },
  });
}
