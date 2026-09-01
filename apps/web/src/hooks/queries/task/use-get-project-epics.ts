import type getTasks from "@/fetchers/task/get-tasks";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";

export type ProjectEpic = Awaited<
  ReturnType<typeof getTasks>
>["columns"][number]["tasks"][number];

// Epics have no dedicated table, so "list a project's epics" reuses the board
// endpoint's `type` filter and flattens its columns/archived/planned buckets,
// mirroring how gantt.tsx and task-relations.tsx already flatten the same
// shape into a plain task list.
export function useGetProjectEpics(projectId: string) {
  const query = useGetTasks(projectId, { type: "epic" });

  const epics =
    query.data == null
      ? []
      : [
          ...query.data.columns.flatMap((column) => column.tasks),
          ...(query.data.archivedTasks ?? []),
          ...(query.data.plannedTasks ?? []),
        ];

  return { ...query, data: epics };
}
