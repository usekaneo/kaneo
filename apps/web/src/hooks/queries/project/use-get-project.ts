import { useQuery } from "@tanstack/react-query";
import getProject from "@/fetchers/project/get-project";

function useGetProject({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId: string;
}) {
  return useQuery({
    queryFn: () => getProject({ id, workspaceId }),
    queryKey: ["projects", workspaceId, id],
    enabled: !!id,
  });
}

export default useGetProject;
