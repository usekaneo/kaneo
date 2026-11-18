import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateGitlabIntegration, {
  type UpdateGitlabIntegrationRequest,
} from "@/fetchers/gitlab-integration/update-gitlab-integration";

export function useUpdateGitlabIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      integrationId,
      json,
    }: {
      projectId: string;
      integrationId: string;
      json: UpdateGitlabIntegrationRequest;
    }) => updateGitlabIntegration(integrationId, json),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["gitlab-integration", projectId],
      });
    },
  });
}
