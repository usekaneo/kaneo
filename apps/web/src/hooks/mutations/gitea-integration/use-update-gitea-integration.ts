import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateGiteaIntegration, {
  type UpdateGiteaIntegrationRequest,
} from "@/fetchers/gitea-integration/update-gitea-integration";

export function useUpdateGiteaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      integrationId,
      json,
    }: {
      projectId: string;
      integrationId: string;
      json: UpdateGiteaIntegrationRequest;
    }) => updateGiteaIntegration(integrationId, json),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["gitea-integration", projectId],
      });
    },
  });
}
