import type { QueryClient } from "@tanstack/react-query";
import type { ProjectWithTasks } from "@/types/project";

/** Refresh only cached boards that contain the relation's parent task. */
export function invalidateRelationTaskProject(
  queryClient: QueryClient,
  taskId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: ["tasks"],
    predicate: ({ state }) => {
      const project = state.data as ProjectWithTasks | undefined;
      return Boolean(
        project?.columns.some((column) =>
          column.tasks.some((task) => task.id === taskId),
        ) ||
          project?.plannedTasks?.some((task) => task.id === taskId) ||
          project?.archivedTasks?.some((task) => task.id === taskId),
      );
    },
  });
}
