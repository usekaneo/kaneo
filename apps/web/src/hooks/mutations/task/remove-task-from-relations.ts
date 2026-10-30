import type { QueryClient } from "@tanstack/react-query";

type Relation = { sourceTaskId: string; targetTaskId: string };

// Cached relation lists are not refetched on mount, so drop deleted tasks here
// or a parent keeps showing a subtask that no longer exists.
export function removeTasksFromRelations(
  queryClient: QueryClient,
  taskIds: string[],
) {
  const deleted = new Set(taskIds);

  for (const taskId of taskIds) {
    queryClient.removeQueries({
      queryKey: ["task-relations", taskId],
      exact: true,
    });
  }

  queryClient.setQueriesData<Relation[]>(
    { queryKey: ["task-relations"] },
    (relations) =>
      relations?.filter(
        (relation) =>
          !deleted.has(relation.sourceTaskId) &&
          !deleted.has(relation.targetTaskId),
      ),
  );

  // Restart any relation fetch still in flight so it can't write the old list back.
  void queryClient.invalidateQueries({ queryKey: ["task-relations"] });
}
