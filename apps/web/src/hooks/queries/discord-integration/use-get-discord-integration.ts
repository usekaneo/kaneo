import { useQuery } from "@tanstack/react-query";
import getDiscordIntegration from "@/fetchers/discord-integration/get-discord-integration";

function useGetDiscordIntegration(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["discord-integration", projectId],
    queryFn: () => getDiscordIntegration(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetDiscordIntegration;
