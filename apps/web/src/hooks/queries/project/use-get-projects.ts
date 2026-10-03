import { useQuery } from "@tanstack/react-query";
import getProjects from "@/fetchers/project/get-projects";

function useGetProjects(
  { workspaceId }: { workspaceId: string },
  refreshWhileVisible = false,
) {
  return useQuery({
    queryFn: () => getProjects({ workspaceId }),
    queryKey: ["projects", workspaceId],
    enabled: !!workspaceId,
    // Home and the sidebar show statistics without a project socket.
    ...(refreshWhileVisible
      ? {
          refetchInterval: 30_000,
          refetchOnWindowFocus: "always" as const,
          refetchOnMount: "always" as const,
        }
      : {}),
  });
}

export default useGetProjects;
