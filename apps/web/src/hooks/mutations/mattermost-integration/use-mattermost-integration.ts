import { useMutation, useQueryClient } from "@tanstack/react-query";
import createMattermostIntegration, {
  type CreateMattermostIntegrationRequest,
} from "@/fetchers/mattermost-integration/create-mattermost-integration";
import deleteMattermostIntegration from "@/fetchers/mattermost-integration/delete-mattermost-integration";
import updateMattermostIntegration, {
  type UpdateMattermostIntegrationRequest,
} from "@/fetchers/mattermost-integration/update-mattermost-integration";

export function useCreateMattermostIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateMattermostIntegrationRequest;
    }) => createMattermostIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["mattermost-integration", projectId],
      });
    },
  });
}

export function useUpdateMattermostIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateMattermostIntegrationRequest;
    }) => updateMattermostIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["mattermost-integration", projectId],
      });
    },
  });
}

export function useDeleteMattermostIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteMattermostIntegration(projectId),
    onSuccess: (_, projectId) => {
      void queryClient.invalidateQueries({
        queryKey: ["mattermost-integration", projectId],
      });
    },
  });
}
