import { useMutation, useQueryClient } from "@tanstack/react-query";
import createGithubIntegration, {
  type CreateGithubIntegrationRequest,
} from "@/fetchers/github-integration/create-github-integration";
import deleteGithubIntegration from "@/fetchers/github-integration/delete-github-integration";
import verifyGithubInstallation, {
  type VerifyGithubInstallationRequest,
} from "@/fetchers/github-integration/verify-github-installation";

export function useCreateGithubIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateGithubIntegrationRequest;
    }) => createGithubIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["github-integration", projectId],
      });
    },
  });
}

export function useDeleteGithubIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteGithubIntegration(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({
        queryKey: ["github-integration", projectId],
      });
    },
  });
}

export function useVerifyGithubInstallation() {
  return useMutation({
    mutationFn: (data: VerifyGithubInstallationRequest) =>
      verifyGithubInstallation(data),
  });
}
