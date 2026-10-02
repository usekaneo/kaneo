import { useQuery } from "@tanstack/react-query";
import getActivitesByTaskId from "@/fetchers/activity/get-activites-by-task-id";

function useGetActivitiesByTaskId(
  taskId: string | undefined,
  refreshWhileVisible = false,
) {
  return useQuery({
    queryKey: ["activities", taskId],
    queryFn: () => {
      if (!taskId) {
        return [];
      }
      return getActivitesByTaskId({ taskId });
    },
    enabled: !!taskId,
    refetchOnMount: refreshWhileVisible ? "always" : false,
    refetchInterval: refreshWhileVisible ? 30_000 : false,
    refetchOnWindowFocus: refreshWhileVisible ? "always" : false,
  });
}

export default useGetActivitiesByTaskId;
