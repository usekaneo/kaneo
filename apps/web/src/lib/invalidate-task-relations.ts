import type { QueryClient } from "@tanstack/react-query";
import { isPerTaskRelationQuery } from "./relation-query-keys";

type Relation = { sourceTaskId: string; targetTaskId: string };

export function invalidateTaskRelations(
  queryClient: QueryClient,
  taskId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: ["task-relations"],
    predicate: (query) => {
      if (!isPerTaskRelationQuery(query)) return false;
      if (query.queryKey[1] === taskId) return true;
      const relations = query.state.data as Relation[] | undefined;
      return (
        relations?.some(
          (relation) =>
            relation.sourceTaskId === taskId ||
            relation.targetTaskId === taskId,
        ) ?? false
      );
    },
    // Closed task details also retain embedded project IDs and numbers, and
    // refetchOnMount is disabled, so refresh inactive relation lists too.
    refetchType: "all",
  });
}
