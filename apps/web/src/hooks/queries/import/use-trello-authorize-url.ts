import { useQuery } from "@tanstack/react-query";
import getTrelloAuthorizeUrl from "@/fetchers/import/get-trello-authorize-url";

function useTrelloAuthorizeUrl(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["import-trello-authorize-url", workspaceId],
    queryFn: () => getTrelloAuthorizeUrl(workspaceId),
    select: (data) => data.authorizeUrl,
    enabled: enabled && Boolean(workspaceId),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export default useTrelloAuthorizeUrl;
