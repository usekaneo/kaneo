import { useQuery } from "@tanstack/react-query";
import getProjects from "@/fetchers/project/get-projects";

function useGetProjects({
  workspaceId,
  enabled = true,
}: {
  workspaceId: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryFn: () => getProjects({ workspaceId }),
    queryKey: ["projects", workspaceId],
    enabled: Boolean(workspaceId) && enabled,
  });
}

export default useGetProjects;
