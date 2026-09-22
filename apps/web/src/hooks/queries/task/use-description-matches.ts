import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getDescriptionMatches } from "@/fetchers/task/get-description-matches";
import type { ProjectWithTasks } from "@/types/project";

export function useDescriptionMatches(
  projectId: string,
  project: ProjectWithTasks | null | undefined,
  textQuery: string,
) {
  const query = textQuery.trim().toLowerCase();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timeout);
  }, [query]);
  const needed =
    project?.id === projectId &&
    !!query &&
    project.columns.some((column) =>
      column.tasks.some((task) => task.descriptionDeferred),
    );
  const result = useQuery({
    // Board mutations already invalidate this project prefix, including edits,
    // imports and websocket events whose omitted text is unchanged in the cache.
    queryKey: ["tasks", projectId, "description-matches", query],
    queryFn: ({ signal }) => getDescriptionMatches(projectId, query, signal),
    enabled: needed && query === debouncedQuery,
    retry: false,
    refetchInterval: needed && query === debouncedQuery ? 30000 : false,
  });
  const ids = useMemo(
    () => new Set(needed ? result.data : []),
    [needed, result.data],
  );
  return {
    ids,
    isLoading: needed && (query !== debouncedQuery || result.isFetching),
    isError: needed && result.isError,
    retry: result.refetch,
  };
}
