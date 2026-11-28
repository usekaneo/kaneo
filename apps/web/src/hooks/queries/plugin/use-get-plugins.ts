import { useQuery } from "@tanstack/react-query";
import getPlugins from "@/fetchers/plugin/get-plugins";

export function useGetPlugins(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["plugins", workspaceId],
    queryFn: () => getPlugins(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60 * 1000,
  });
}
