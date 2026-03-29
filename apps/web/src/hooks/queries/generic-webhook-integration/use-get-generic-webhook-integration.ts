import { useQuery } from "@tanstack/react-query";
import getGenericWebhookIntegration from "@/fetchers/generic-webhook-integration/get-generic-webhook-integration";

function useGetGenericWebhookIntegration(projectId: string) {
  return useQuery({
    queryKey: ["generic-webhook-integration", projectId],
    queryFn: () => getGenericWebhookIntegration(projectId),
  });
}

export default useGetGenericWebhookIntegration;
