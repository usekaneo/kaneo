import { useQuery } from "@tanstack/react-query";
import getGitlabIntegration from "@/fetchers/gitlab-integration/get-gitlab-integration";

function useGetGitlabIntegration(projectId: string) {
  return useQuery({
    queryKey: ["gitlab-integration", projectId],
    queryFn: () => getGitlabIntegration(projectId),
    enabled: !!projectId,
  });
}

export default useGetGitlabIntegration;
