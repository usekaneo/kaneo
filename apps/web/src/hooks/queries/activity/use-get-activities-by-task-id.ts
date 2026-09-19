import { useQuery } from "@tanstack/react-query";
import getActivitesByTaskId from "@/fetchers/activity/get-activites-by-task-id";

function useGetActivitiesByTaskId(taskId: string | undefined) {
  return useQuery({
    queryKey: ["activities", taskId],
    queryFn: () => getActivitesByTaskId({ taskId: taskId! }),
    enabled: !!taskId,
  });
}

export default useGetActivitiesByTaskId;
