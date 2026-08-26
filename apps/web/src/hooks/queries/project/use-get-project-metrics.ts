import { useQuery } from "@tanstack/react-query";
import getProjectMetrics from "@/fetchers/project/get-project-metrics";

function useGetProjectMetrics({
  projectId,
  enabled = true,
}: {
  projectId: string | undefined;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["project-metrics", projectId],
    queryFn: () => getProjectMetrics({ id: projectId as string }),
    enabled: Boolean(projectId) && enabled,
  });
}

export default useGetProjectMetrics;
