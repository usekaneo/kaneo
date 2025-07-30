import { useQuery } from "@tanstack/react-query";
import getLabelsByWorkspace from "../../../fetchers/label/get-labels-by-workspace";

function useGetLabelsByWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ["labels", "workspace", workspaceId],
    queryFn: () => getLabelsByWorkspace({ workspaceId }),
    enabled: !!workspaceId,
  });
}

export default useGetLabelsByWorkspace;
