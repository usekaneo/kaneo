import type { QueryClient } from "@tanstack/react-query";
import { tasksQueryOptions } from "./tasks-query-options";

export function prefetchBoard(queryClient: QueryClient, projectId: string) {
  const options = tasksQueryOptions(queryClient, projectId);
  if (queryClient.getQueryState(options.queryKey)?.data !== undefined) return;
  return queryClient.prefetchQuery(options);
}
