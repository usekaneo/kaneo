import type { QueryClient } from "@tanstack/react-query";
import getTask from "@/fetchers/task/get-task";

const PREFETCH_FRESH_MS = 15_000;

export function prefetchTask(queryClient: QueryClient, taskId: string) {
  return queryClient.prefetchQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId),
    staleTime: PREFETCH_FRESH_MS,
  });
}
