import { useQuery } from "@tanstack/react-query";
import getSlackIntegration from "@/fetchers/slack-integration/get-slack-integration";

function useGetSlackIntegration(projectId: string) {
  return useQuery({
    queryKey: ["slack-integration", projectId],
    queryFn: () => getSlackIntegration(projectId),
    enabled: Boolean(projectId),
  });
}

export default useGetSlackIntegration;
