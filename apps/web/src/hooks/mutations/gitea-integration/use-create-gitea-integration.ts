import { useMutation, useQueryClient } from "@tanstack/react-query";
import createGiteaIntegration, {
  type CreateGiteaIntegrationRequest,
} from "@/fetchers/gitea-integration/create-gitea-integration";
import deleteGiteaIntegration from "@/fetchers/gitea-integration/delete-gitea-integration";
import verifyGiteaAccess, {
  type VerifyGiteaAccessRequest,
} from "@/fetchers/gitea-integration/verify-gitea-access";

export function useCreateGiteaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateGiteaIntegrationRequest;
    }) => createGiteaIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["gitea-integration", projectId],
      });
    },
  });
}

export function useDeleteGiteaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteGiteaIntegration(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({
        queryKey: ["gitea-integration", projectId],
      });
    },
  });
}

export function useVerifyGiteaAccess() {
  return useMutation({
    mutationFn: (data: VerifyGiteaAccessRequest) => verifyGiteaAccess(data),
  });
}
