import { useQuery } from "@tanstack/react-query";
import getGenericWebhookIntegration from "@/fetchers/generic-webhook-integration/get-generic-webhook-integration";

function useGetGenericWebhookIntegration(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["generic-webhook-integration", projectId],
    queryFn: () => getGenericWebhookIntegration(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetGenericWebhookIntegration;
