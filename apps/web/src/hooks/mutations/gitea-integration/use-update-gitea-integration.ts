import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateGiteaIntegration, {
  type UpdateGiteaIntegrationRequest,
} from "@/fetchers/gitea-integration/update-gitea-integration";

export function useUpdateGiteaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateGiteaIntegrationRequest;
    }) => updateGiteaIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["gitea-integration", projectId],
      });
    },
  });
}
