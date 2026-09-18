import { useQuery } from "@tanstack/react-query";
import { getLinkPreview } from "@/fetchers/link-preview";

export function useLinkPreview(workspaceId: string | undefined, url: string) {
  return useQuery({
    queryKey: ["link-preview", workspaceId, url],
    queryFn: () => getLinkPreview(workspaceId as string, url),
    enabled: !!workspaceId,
    // The server caches for hours; a page's title rarely changes mid-chat.
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
