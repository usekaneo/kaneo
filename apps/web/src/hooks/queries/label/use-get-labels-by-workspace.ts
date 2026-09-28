import { useQuery } from "@tanstack/react-query";
import getLabelsByWorkspace from "@/fetchers/label/get-label-by-workspace";
import { localeCompareSort } from "@/lib/format";

function useGetLabelsByWorkspace(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: ["labels", workspaceId],
    queryFn: () => getLabelsByWorkspace({ workspaceId }),
    select: (labels) =>
      [...labels].sort((a, b) => localeCompareSort(a.name, b.name)),
  });
}

export default useGetLabelsByWorkspace;
