import { useQuery } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";
import { isUnauthorizedError } from "@/lib/http-error";

export function useGetTasks(
  projectId: string,
  filters?: { type?: "task" | "epic" },
) {
  return useQuery({
    // Unfiltered callers keep the plain ["tasks", projectId] key that every
    // mutation already invalidates; a type filter gets its own cache entry
    // (invalidating ["tasks", projectId] still matches it as a key prefix).
    queryKey: filters?.type
      ? (["tasks", projectId, filters.type] as const)
      : (["tasks", projectId] as const),
    queryFn: () => getTasks(projectId, filters),
    refetchInterval: (query) =>
      isUnauthorizedError(query.state.error) ? false : 30000,
    enabled: !!projectId,
  });
}
