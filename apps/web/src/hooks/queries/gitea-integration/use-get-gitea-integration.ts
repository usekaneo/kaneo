import { useQuery } from "@tanstack/react-query";
import getGiteaIntegration from "@/fetchers/gitea-integration/get-gitea-integration";

function useGetGiteaIntegration(projectId: string) {
  return useQuery({
    queryKey: ["gitea-integration", projectId],
    queryFn: () => getGiteaIntegration(projectId),
    enabled: !!projectId,
  });
}

export default useGetGiteaIntegration;
