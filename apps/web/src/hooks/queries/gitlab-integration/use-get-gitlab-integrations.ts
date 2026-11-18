import { useQuery } from "@tanstack/react-query";
import getGitlabIntegrations from "@/fetchers/gitlab-integration/get-gitlab-integrations";

// The extra "list" segment keeps this cache entry apart from the compat
// single-binding query on the same ["gitlab-integration", projectId] prefix,
// which the existing mutations and the websocket still invalidate by project.
function useGetGitlabIntegrations(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["gitlab-integration", projectId, "list"],
    queryFn: () => getGitlabIntegrations(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetGitlabIntegrations;
