import { useQuery } from "@tanstack/react-query";
import getGithubIntegrations from "@/fetchers/github-integration/get-github-integrations";

// The extra "list" segment keeps this cache entry apart from the compat
// single-binding query on the same ["github-integration", projectId] prefix,
// which the existing mutations and the websocket still invalidate by project.
function useGetGithubIntegrations(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["github-integration", projectId, "list"],
    queryFn: () => getGithubIntegrations(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetGithubIntegrations;
