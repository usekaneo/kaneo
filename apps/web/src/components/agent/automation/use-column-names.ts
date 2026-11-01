import { useQueries } from "@tanstack/react-query";
import getColumns from "@/fetchers/column/get-columns";
import { uniqueNames } from "./unique-names";

// Column names across the given projects, loaded only when needed.
export function useColumnNames(projectIds: string[], enabled: boolean) {
  const results = useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: ["columns", projectId],
      queryFn: () => getColumns(projectId),
      enabled,
      staleTime: 60_000,
    })),
  });
  return uniqueNames(
    results.flatMap(
      (result) => result.data?.map((column) => column.name) ?? [],
    ),
  );
}
