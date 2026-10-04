import { useQuery } from "@tanstack/react-query";
import getGithubIntegration from "@/fetchers/github-integration/get-github-integration";

function useGetGithubIntegration(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["github-integration", projectId],
    queryFn: () => getGithubIntegration(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetGithubIntegration;
