import { useQuery } from "@tanstack/react-query";
import getGithubIntegration from "@/fetchers/github-integration/get-github-integration";

function useGetGithubIntegration(projectId: string) {
  return useQuery({
    queryKey: ["github-integration", projectId],
    queryFn: () => getGithubIntegration(projectId),
    enabled: !!projectId,
  });
}

export default useGetGithubIntegration;
