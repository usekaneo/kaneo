import { useQuery } from "@tanstack/react-query";
import getMattermostIntegration from "@/fetchers/mattermost-integration/get-mattermost-integration";

function useGetMattermostIntegration(projectId: string) {
  return useQuery({
    queryKey: ["mattermost-integration", projectId],
    queryFn: () => getMattermostIntegration(projectId),
    enabled: Boolean(projectId),
  });
}

export default useGetMattermostIntegration;
