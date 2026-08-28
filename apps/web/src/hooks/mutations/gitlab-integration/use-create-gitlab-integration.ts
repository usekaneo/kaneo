import { useMutation, useQueryClient } from "@tanstack/react-query";
import createGitlabIntegration, {
  type CreateGitlabIntegrationRequest,
} from "@/fetchers/gitlab-integration/create-gitlab-integration";
import deleteGitlabIntegration from "@/fetchers/gitlab-integration/delete-gitlab-integration";
import verifyGitlabAccess, {
  type VerifyGitlabAccessRequest,
} from "@/fetchers/gitlab-integration/verify-gitlab-access";

export function useCreateGitlabIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateGitlabIntegrationRequest;
    }) => createGitlabIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["gitlab-integration", projectId],
      });
    },
  });
}

export function useDeleteGitlabIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteGitlabIntegration(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({
        queryKey: ["gitlab-integration", projectId],
      });
    },
  });
}

export function useVerifyGitlabAccess() {
  return useMutation({
    mutationFn: (data: VerifyGitlabAccessRequest) => verifyGitlabAccess(data),
  });
}
