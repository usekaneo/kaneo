import { useQuery } from "@tanstack/react-query";
import getActivitesByTaskId from "@/fetchers/activity/get-activites-by-task-id";

function useGetActivitiesByTaskId(taskId: string | undefined) {
  return useQuery({
    queryKey: ["activities", taskId],
    queryFn: () => {
      if (!taskId) {
        return [];
      }
      return getActivitesByTaskId({ taskId });
    },
    enabled: !!taskId,
  });
}

export default useGetActivitiesByTaskId;
