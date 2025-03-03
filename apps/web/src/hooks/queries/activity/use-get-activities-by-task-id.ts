import getActivitesByTaskId from "@/fetchers/activity/get-activites-by-task-id";
import { useQuery } from "@tanstack/react-query";

function useGetActivitiesByTaskId(taskId: string) {
  return useQuery({
    queryKey: ["activities", taskId],
    queryFn: () => getActivitesByTaskId(taskId),
  });
}

export default useGetActivitiesByTaskId;
