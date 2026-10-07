import type { QueryClient } from "@tanstack/react-query";
import { visitRecords } from "./visit-records";

export function evictProjectCache(client: QueryClient, projectId: string) {
  const queries = client.getQueryCache().getAll();
  const ids = new Set([projectId]);
  for (const query of queries)
    visitRecords(query.state.data, (record) => {
      if (typeof record.id === "string" && record.projectId === projectId)
        ids.add(record.id);
    });
  const references = (value: unknown) =>
    typeof value === "string" && ids.has(value);
  const predicate = (query: (typeof queries)[number]) => {
    let affected = query.queryKey.some(references);
    visitRecords([query.queryKey, query.state.data], (record) => {
      if (Object.values(record).some(references)) affected = true;
    });
    return affected;
  };
  void client.cancelQueries({ predicate });
  client.removeQueries({
    predicate: (query) => predicate(query) && !query.isActive(),
  });
  void client.resetQueries({
    predicate: (query) => predicate(query) && query.isActive(),
  });
}
