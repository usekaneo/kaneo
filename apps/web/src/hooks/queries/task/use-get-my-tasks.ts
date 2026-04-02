import { useQuery } from "@tanstack/react-query";
import getMyTasks from "@/fetchers/task/get-my-tasks";
import {
  getVisibleTabRefetchInterval,
  visibleTabRefetchDefaults,
} from "@/lib/get-visible-tab-refetch-interval";

function useGetMyTasks(workspaceId: string) {
  return useQuery({
    queryKey: ["my-tasks", workspaceId],
    queryFn: () => getMyTasks({ workspaceId }),
    enabled: !!workspaceId,
    refetchInterval: getVisibleTabRefetchInterval(10000),
    ...visibleTabRefetchDefaults,
  });
}

export default useGetMyTasks;
