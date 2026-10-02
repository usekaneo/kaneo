import { useQuery } from "@tanstack/react-query";
import getProjects from "@/fetchers/project/get-projects";

function useGetProjects({ workspaceId }: { workspaceId: string }) {
  return useQuery({
    queryFn: () => getProjects({ workspaceId }),
    queryKey: ["projects", workspaceId],
    enabled: !!workspaceId,
    // Home and the sidebar show statistics without a project socket.
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });
}

export default useGetProjects;
