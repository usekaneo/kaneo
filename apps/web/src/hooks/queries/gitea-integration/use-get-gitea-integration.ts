import { useQuery } from "@tanstack/react-query";
import getGiteaIntegration from "@/fetchers/gitea-integration/get-gitea-integration";

function useGetGiteaIntegration(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["gitea-integration", projectId],
    queryFn: () => getGiteaIntegration(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetGiteaIntegration;
