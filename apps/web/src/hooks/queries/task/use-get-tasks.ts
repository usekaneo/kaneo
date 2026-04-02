import { useQuery } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";
import {
  getVisibleTabRefetchInterval,
  visibleTabRefetchDefaults,
} from "@/lib/get-visible-tab-refetch-interval";

export function useGetTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => getTasks(projectId),
    refetchInterval: getVisibleTabRefetchInterval(10000),
    ...visibleTabRefetchDefaults,
    enabled: !!projectId,
  });
}
