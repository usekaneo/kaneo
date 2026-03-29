import { useQuery } from "@tanstack/react-query";
import getDiscordIntegration from "@/fetchers/discord-integration/get-discord-integration";

function useGetDiscordIntegration(projectId: string) {
  return useQuery({
    queryKey: ["discord-integration", projectId],
    queryFn: () => getDiscordIntegration(projectId),
  });
}

export default useGetDiscordIntegration;
