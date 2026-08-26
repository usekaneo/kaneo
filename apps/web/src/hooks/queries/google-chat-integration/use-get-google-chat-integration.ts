import { useQuery } from "@tanstack/react-query";
import getGoogleChatIntegration from "@/fetchers/google-chat-integration/get-google-chat-integration";

function useGetGoogleChatIntegration(projectId: string) {
  return useQuery({
    queryKey: ["google-chat-integration", projectId],
    queryFn: () => getGoogleChatIntegration(projectId),
    enabled: Boolean(projectId),
  });
}

export default useGetGoogleChatIntegration;
