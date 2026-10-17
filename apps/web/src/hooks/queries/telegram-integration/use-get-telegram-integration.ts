import { useQuery } from "@tanstack/react-query";
import getTelegramIntegration from "@/fetchers/telegram-integration/get-telegram-integration";

function useGetTelegramIntegration(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["telegram-integration", projectId],
    queryFn: () => getTelegramIntegration(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetTelegramIntegration;
