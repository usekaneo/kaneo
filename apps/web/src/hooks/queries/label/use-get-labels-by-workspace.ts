import getLabelsByWorkspace from "@/fetchers/label/get-label-by-workspace";
import { useQuery } from "@tanstack/react-query";

function useGetLabelsByWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ["labels", workspaceId],
    queryFn: () => getLabelsByWorkspace({ workspaceId }),
  });
}

export default useGetLabelsByWorkspace;
