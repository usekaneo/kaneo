import { useMemo, useState } from "react";
import { useFilterSubjects } from "@/components/project/task-filters/use-filter-subjects";
import { useTaskFilterOptions } from "@/components/project/task-filters/use-task-filter-options";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetWorkspaceBoard } from "@/hooks/queries/task/use-get-workspace-board";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import { toWorkspaceBoardQuery } from "@/lib/workspace-board-query";
import { useUserPreferencesStore } from "@/store/user-preferences";

export type WorkspaceTaskView = ReturnType<typeof useWorkspaceTaskView>;

/**
 * Filters, the server query they translate to, the merged board and the
 * filter subjects for one workspace. The client-side filter pass runs over
 * the server result as well, so text search and "no due date" work the same
 * way they do on a project board.
 */
export function useWorkspaceTaskView(workspaceId: string) {
  const [search, setSearch] = useState("");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const options = useTaskFilterOptions(undefined, workspaceId);
  // Without a project the hook needs the workspace to expand saved label
  // filters to every copy of a label, as the server does.
  const filters = useTaskFiltersWithLabelsSupport(
    undefined,
    `workspace:${workspaceId}`,
    search,
    undefined,
    undefined,
    workspaceId,
  );
  const { isPending: labelsPending } = useGetLabelsByWorkspace(workspaceId);
  // A saved label filter needs the labels to build its query; loading without
  // them would fetch the whole board twice.
  const waitForLabels =
    Boolean(filters.filters.labels?.length) && labelsPending;
  const serverQuery = useMemo(
    () =>
      toWorkspaceBoardQuery(filters.filters, includeCompleted, {
        weekStartsOn,
        labels: options.labels,
      }),
    [filters.filters, includeCompleted, weekStartsOn, options.labels],
  );
  const {
    data: board,
    isError,
    refetch,
  } = useGetWorkspaceBoard(workspaceId, serverQuery, {
    enabled: !waitForLabels,
  });
  const { filterTasks } = filters;
  const filteredBoard = useMemo(
    () =>
      board
        ? {
            ...board,
            columns: board.columns.map((column) => ({
              ...column,
              tasks: filterTasks(column.tasks),
            })),
          }
        : undefined,
    [board, filterTasks],
  );
  const tasks = useMemo(
    () => board?.columns.flatMap((column) => column.tasks) ?? [],
    [board],
  );
  const subjects = useFilterSubjects({
    controls: filters,
    options,
    columns: board?.columns,
    tasks,
    showStatus: true,
    projects: board?.projects ?? [],
  });

  return {
    search,
    setSearch,
    includeCompleted,
    setIncludeCompleted,
    filters,
    subjects,
    members: options.members,
    serverQuery,
    board,
    filteredBoard,
    isError,
    refetch,
  };
}
