import {
  DEFAULT_FILTERS,
  normalizeFilters,
} from "@/lib/task-filters/filter-config";
import { useCallback, useMemo } from "react";
import { countActiveFilters } from "@/lib/task-filters/count-active-filters";
import { filterProjectTasks } from "@/lib/task-filters/filter-project-tasks";
import { customFieldSubjectId } from "@/lib/task-filters/filter-subject-id";
import { setSubjectNegated } from "@/lib/task-filters/set-subject-negated";
import { taskMatchesFilters } from "@/lib/task-filters/task-matches-filters";
import { toggleFilterValue } from "@/lib/task-filters/toggle-filter-value";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import useGetCachedCustomFieldValues from "./queries/custom-field/use-get-all-custom-field-values-by-project";
import type { BoardFilters } from "./use-task-filters";
import { useLocalDay } from "./use-local-day";
import { useStoredState } from "./use-stored-state";

const NO_IGNORED_FILTERS: ReadonlyArray<keyof BoardFilters> = [];

export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  descriptionMatches?: ReadonlySet<string>,
  ignore: ReadonlyArray<keyof BoardFilters> = NO_IGNORED_FILTERS,
) {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const day = useLocalDay();
  const [filters, setFilters] = useStoredState(
    projectId ? `kaneo:board-filters:${projectId}` : null,
    normalizeFilters,
    DEFAULT_FILTERS,
  );
  const { getValuesForTask } = useGetCachedCustomFieldValues();

  const effectiveFilters = useMemo(
    () =>
      ignore.length === 0
        ? filters
        : ({
            ...filters,
            ...Object.fromEntries(ignore.map((key) => [key, null])),
          } as BoardFilters),
    [filters, ignore],
  );

  const createMatcher = useCallback(() => {
    const context = {
      query: textQuery,
      projectSlug: project?.slug,
      descriptionMatches,
      weekStartsOn,
      today: new Date(day),
      getCustomFieldValues: getValuesForTask,
    };
    return (task: Task) => taskMatchesFilters(task, effectiveFilters, context);
  }, [
    effectiveFilters,
    project?.slug,
    textQuery,
    weekStartsOn,
    getValuesForTask,
    descriptionMatches,
    day,
  ]);

  const filterTasks = useCallback(
    (tasks: Task[]): Task[] => tasks.filter(createMatcher()),
    [createMatcher],
  );

  const filteredProject = useMemo(
    () => (project ? filterProjectTasks(project, createMatcher()) : null),
    [project, createMatcher],
  );

  const activeFilterCount = countActiveFilters(effectiveFilters);
  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setFilters((prev) =>
      ignore.length === 0
        ? DEFAULT_FILTERS
        : ({
            ...DEFAULT_FILTERS,
            ...Object.fromEntries(ignore.map((key) => [key, prev[key]])),
            negated:
              prev.negated?.filter((subject) =>
                (ignore as ReadonlyArray<string>).includes(subject),
              ) ?? null,
          } as BoardFilters),
    );
  };

  const updateFilter = (
    key: keyof BoardFilters,
    value: BoardFilters[keyof BoardFilters],
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      negated:
        value === null
          ? setSubjectNegated(prev.negated, key, false)
          : prev.negated,
    }));
  };

  const setNegated = (subject: string, negated: boolean) => {
    setFilters((prev) => ({
      ...prev,
      negated: setSubjectNegated(prev.negated, subject, negated),
    }));
  };

  const toggleFilter = (
    key:
      | "status"
      | "priority"
      | "assignee"
      | "dueDate"
      | "createdDate"
      | "labels",
    value: string,
  ) => {
    setFilters((prev) => {
      const next = toggleFilterValue(prev[key], value);
      return {
        ...prev,
        [key]: next,
        negated: next
          ? prev.negated
          : setSubjectNegated(prev.negated, key, false),
      };
    });
  };

  const updateLabelFilter = (labelId: string) => {
    setFilters((prev) => ({
      ...prev,
      labels: toggleFilterValue(prev.labels, labelId),
    }));
  };

  const updateCustomFieldFilter = (fieldId: string, value: string) => {
    setFilters((prev) => {
      const updated = { ...prev.customFields };
      const next = toggleFilterValue(updated[fieldId], value);
      if (next) {
        updated[fieldId] = next;
      } else {
        delete updated[fieldId];
      }
      return {
        ...prev,
        customFields: Object.keys(updated).length > 0 ? updated : null,
        negated: next
          ? prev.negated
          : setSubjectNegated(
              prev.negated,
              customFieldSubjectId(fieldId),
              false,
            ),
      };
    });
  };

  return {
    filters: effectiveFilters,
    setFilters,
    updateFilter,
    toggleFilter,
    setNegated,
    updateLabelFilter,
    updateCustomFieldFilter,
    filterTasks,
    filteredProject,
    activeFilterCount,
    hasActiveFilters,
    clearFilters,
  };
}
