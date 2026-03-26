import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateGithubIntegration, {
  type UpdateGithubIntegrationRequest,
} from "@/fetchers/github-integration/update-github-integration";

export function useUpdateGithubIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateGithubIntegrationRequest;
    }) => updateGithubIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["github-integration", projectId],
      });
    },
  });
}
