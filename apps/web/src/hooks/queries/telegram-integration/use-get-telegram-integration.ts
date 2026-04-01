import { useQuery } from "@tanstack/react-query";
import getTelegramIntegration from "@/fetchers/telegram-integration/get-telegram-integration";

function useGetTelegramIntegration(projectId: string) {
  return useQuery({
    queryKey: ["telegram-integration", projectId],
    queryFn: () => getTelegramIntegration(projectId),
    enabled: Boolean(projectId),
  });
}

export default useGetTelegramIntegration;
