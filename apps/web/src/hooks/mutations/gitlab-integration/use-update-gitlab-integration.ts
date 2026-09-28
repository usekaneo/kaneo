import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateGitlabIntegration, {
  type UpdateGitlabIntegrationRequest,
} from "@/fetchers/gitlab-integration/update-gitlab-integration";

export function useUpdateGitlabIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateGitlabIntegrationRequest;
    }) => updateGitlabIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["gitlab-integration", projectId],
      });
    },
  });
}
