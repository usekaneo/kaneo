import { useMemo, useState } from "react";
import { useFilterSubjects } from "@/components/project/task-filters/use-filter-subjects";
import { useTaskFilterOptions } from "@/components/project/task-filters/use-task-filter-options";
import { useGetSprints } from "@/hooks/queries/sprint/use-get-sprints";
import { useDescriptionMatches } from "@/hooks/queries/task/use-description-matches";
import type { BoardFilters } from "@/hooks/use-task-filters";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import type { ProjectWithTasks } from "@/types/project";
import { scopeTasks } from "./scope-tasks";
import { filterProjectBySprintScope, type SprintScope } from "./sprint-scope";

const NO_IGNORED_FILTERS: ReadonlyArray<keyof BoardFilters> = [];
const BACKLOG_IGNORED_FILTERS: ReadonlyArray<keyof BoardFilters> = ["status"];

export type TaskViewScope = "board" | "backlog" | "schedule";

export type ProjectTaskView = ReturnType<typeof useProjectTaskView>;

export function useProjectTaskView({
  project,
  projectId,
  workspaceId,
  scope,
  sprintScope,
}: {
  project: ProjectWithTasks | null | undefined;
  projectId: string;
  workspaceId: string;
  scope: TaskViewScope;
  sprintScope?: SprintScope;
}) {
  const ignore =
    scope === "backlog" ? BACKLOG_IGNORED_FILTERS : NO_IGNORED_FILTERS;
  const [search, setSearch] = useState("");
  const descriptionSearch = useDescriptionMatches(projectId, project, search);
  const { data: sprints = [] } = useGetSprints(projectId);
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
    sprints,
  });

  // The board opens on the sprint slice the user picked, on top of the
  // regular filters. Views without a sprint scope are not restricted.
  const filteredProject = useMemo(
    () =>
      sprintScope && filters.filteredProject
        ? filterProjectBySprintScope(
            filters.filteredProject,
            sprintScope,
            sprints,
          )
        : filters.filteredProject,
    [filters.filteredProject, sprintScope, sprints],
  );

  return {
    search,
    setSearch,
    descriptionSearch,
    filters,
    subjects,
    filteredProject,
  };
}
