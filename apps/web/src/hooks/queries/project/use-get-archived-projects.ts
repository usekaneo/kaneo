import { useQuery } from "@tanstack/react-query";
import getArchivedProjects from "@/fetchers/project/get-archived-projects";

function useGetArchivedProjects({
  workspaceId,
  enabled = true,
}: {
  workspaceId: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryFn: () => getArchivedProjects({ workspaceId }),
    queryKey: ["projects", workspaceId, "archived"],
    enabled: Boolean(workspaceId) && enabled,
  });
}

export default useGetArchivedProjects;
