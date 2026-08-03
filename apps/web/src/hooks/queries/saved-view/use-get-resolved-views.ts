import { useQuery } from "@tanstack/react-query";
import getResolvedViews from "@/fetchers/saved-view/get-resolved-views";

function useGetResolvedViews({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  return useQuery({
    enabled: Boolean(workspaceId && projectId),
    queryKey: ["saved-views", workspaceId, projectId],
    queryFn: () => getResolvedViews({ workspaceId, projectId }),
  });
}

export default useGetResolvedViews;
