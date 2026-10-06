import { useQuery } from "@tanstack/react-query";
import getProjects from "@/fetchers/project/get-projects";

function useGetProjects(
  {
    workspaceId,
    includeArchived = false,
    enabled = true,
  }: { workspaceId: string; includeArchived?: boolean; enabled?: boolean },
  refreshWhileVisible = false,
) {
  return useQuery({
    queryFn: () =>
      getProjects(
        includeArchived
          ? { workspaceId, includeArchived: "true" }
          : { workspaceId },
      ),
    queryKey: includeArchived
      ? ["projects", workspaceId, "including-archived"]
      : ["projects", workspaceId],
    enabled: enabled && !!workspaceId,
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
