import { useQuery } from "@tanstack/react-query";
import { getTaskShare } from "@/fetchers/task-share";

export function useGetTaskShare(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["task-share", taskId],
    queryFn: () => getTaskShare(taskId),
    enabled: enabled && Boolean(taskId),
    staleTime: 0,
    retry: false,
  });
}
