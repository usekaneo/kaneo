import { useQuery } from "@tanstack/react-query";
import getGiteaIntegrations from "@/fetchers/gitea-integration/get-gitea-integrations";

// The extra "list" segment keeps this cache entry apart from the compat
// single-binding query on the same ["gitea-integration", projectId] prefix,
// which the existing mutations and the websocket still invalidate by project.
function useGetGiteaIntegrations(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["gitea-integration", projectId, "list"],
    queryFn: () => getGiteaIntegrations(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetGiteaIntegrations;
