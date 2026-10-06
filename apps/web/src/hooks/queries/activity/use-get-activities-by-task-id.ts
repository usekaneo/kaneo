import { useQuery } from "@tanstack/react-query";
import getActivitesByTaskId from "@/fetchers/activity/get-activites-by-task-id";

function useGetActivitiesByTaskId(
  taskId: string | undefined,
  refreshWhileVisible = false,
  limit?: number,
) {
  return useQuery({
    queryKey:
      limit === undefined
        ? ["activities", taskId]
        : ["activities", taskId, { limit }],
    queryFn: () => {
      if (!taskId) {
        return [];
      }
      return getActivitesByTaskId({ taskId, limit });
    },
    enabled: !!taskId,
    refetchOnMount: refreshWhileVisible ? "always" : false,
    refetchInterval: refreshWhileVisible ? 30_000 : false,
    refetchOnWindowFocus: refreshWhileVisible ? "always" : false,
  });
}

export default useGetActivitiesByTaskId;
