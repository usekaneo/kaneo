import { useQuery } from "@tanstack/react-query";
import getGitlabIntegration from "@/fetchers/gitlab-integration/get-gitlab-integration";

function useGetGitlabIntegration(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["gitlab-integration", projectId],
    queryFn: () => getGitlabIntegration(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetGitlabIntegration;
