import { useMemo, useState } from "react";
import { useFilterSubjects } from "@/components/project/task-filters/use-filter-subjects";
import { useTaskFilterOptions } from "@/components/project/task-filters/use-task-filter-options";
import { useDescriptionMatches } from "@/hooks/queries/task/use-description-matches";
import type { BoardFilters } from "@/hooks/use-task-filters";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import type { ProjectWithTasks } from "@/types/project";
import { scopeTasks } from "./scope-tasks";

const NO_IGNORED_FILTERS: ReadonlyArray<keyof BoardFilters> = [];
const BACKLOG_IGNORED_FILTERS: ReadonlyArray<keyof BoardFilters> = ["status"];

export type TaskViewScope = "board" | "backlog" | "schedule";

export type ProjectTaskView = ReturnType<typeof useProjectTaskView>;

export function useProjectTaskView({
  project,
  projectId,
  workspaceId,
  scope,
}: {
  project: ProjectWithTasks | null | undefined;
  projectId: string;
  workspaceId: string;
  scope: TaskViewScope;
}) {
  const ignore =
    scope === "backlog" ? BACKLOG_IGNORED_FILTERS : NO_IGNORED_FILTERS;
  const [search, setSearch] = useState("");
  const descriptionSearch = useDescriptionMatches(projectId, project, search);
  const filters = useTaskFiltersWithLabelsSupport(
    project,
    projectId,
    search,
    descriptionSearch.ids,
    ignore,
  );
  const options = useTaskFilterOptions(projectId, workspaceId);
  const tasks = useMemo(() => scopeTasks(project, scope), [project, scope]);
  const subjects = useFilterSubjects({
    controls: filters,
    options,
    columns: project?.columns,
    tasks,
    showStatus: scope !== "backlog",
  });

  return { search, setSearch, descriptionSearch, filters, subjects };
}
