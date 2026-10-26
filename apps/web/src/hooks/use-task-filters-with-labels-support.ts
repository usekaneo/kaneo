import { useCallback, useMemo } from "react";
import { countActiveFilters } from "@/lib/task-filters/count-active-filters";
import { filterProjectTasks } from "@/lib/task-filters/filter-project-tasks";
import {
  expandLabelFilter,
  type FilterLabel,
} from "@/lib/task-filters/label-groups";
import { customFieldSubjectId } from "@/lib/task-filters/filter-subject-id";
import { setSubjectNegated } from "@/lib/task-filters/set-subject-negated";
import { taskMatchesFilters } from "@/lib/task-filters/task-matches-filters";
import { toggleFilterValue } from "@/lib/task-filters/toggle-filter-value";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import useGetCachedCustomFieldValues from "./queries/custom-field/use-get-all-custom-field-values-by-project";
import useGetLabelsByWorkspace from "./queries/label/use-get-labels-by-workspace";
import type { BoardFilters } from "./use-task-filters";
import { useStoredState } from "./use-stored-state";

const DEFAULT_FILTERS: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
  customFields: null,
  negated: null,
};

const NO_IGNORED_FILTERS: ReadonlyArray<keyof BoardFilters> = [];

const FILTER_KEYS: Array<keyof BoardFilters> = [
  "status",
  "priority",
  "assignee",
  "dueDate",
  "labels",
  "customFields",
  "negated",
];

function normalizeFilters(raw: unknown): BoardFilters {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_FILTERS;
  }

  const candidate = raw as Partial<Record<keyof BoardFilters, unknown>>;
  const normalized = { ...DEFAULT_FILTERS };

  for (const key of FILTER_KEYS) {
    if (key === "customFields") {
      const value = candidate.customFields;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const customFields = Object.fromEntries(
          Object.entries(value).filter(
            ([, values]) =>
              Array.isArray(values) &&
              values.length > 0 &&
              values.every((item) => typeof item === "string"),
          ),
        ) as Record<string, string[]>;

        normalized.customFields =
          Object.keys(customFields).length > 0 ? customFields : null;
      }

      continue;
    }
    const value = candidate[key];
    if (Array.isArray(value)) {
      const values = value.filter((v): v is string => typeof v === "string");
      normalized[key] = values.length > 0 ? values : null;
    }
  }

  return normalized;
}

export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  descriptionMatches?: ReadonlySet<string>,
  ignore: ReadonlyArray<keyof BoardFilters> = NO_IGNORED_FILTERS,
) {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const [filters, setFilters] = useStoredState(
    projectId ? `kaneo:board-filters:${projectId}` : null,
    normalizeFilters,
    DEFAULT_FILTERS,
  );
  const { data: workspaceLabels } = useGetLabelsByWorkspace(
    project?.workspaceId ?? "",
  );
  const labels = useMemo(() => {
    if (!filters.labels?.length) return [];
    const byId = new Map<string, FilterLabel>(
      (workspaceLabels ?? []).map((label) => [label.id, label]),
    );
    const tasks = [
      ...(project?.columns.flatMap((column) => column.tasks) ?? []),
      ...(project?.plannedTasks ?? []),
      ...(project?.archivedTasks ?? []),
    ];
    for (const task of tasks) {
      // A live task update may be newer than the workspace-label query.
      for (const label of task.labels ?? []) byId.set(label.id, label);
    }
    return [...byId.values()];
  }, [workspaceLabels, project, filters.labels]);

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
  // Expansion is matching-only: controls must edit the saved selection.
  const matchingLabelIds = useMemo(
    () => new Set(expandLabelFilter(labels, effectiveFilters.labels)),
    [labels, effectiveFilters.labels],
  );
  const customFieldValues = useGetCachedCustomFieldValues(
    effectiveFilters.customFields ? projectId : undefined,
  );
  const { getValuesForTask, hasData } = customFieldValues;

  const createMatcher = useCallback(() => {
    const context = {
      query: textQuery,
      projectSlug: project?.slug,
      descriptionMatches,
      weekStartsOn,
      today: new Date(),
      getCustomFieldValues: getValuesForTask,
      labelIds: matchingLabelIds,
    };
    // Missing query data is unknown, rather than an empty value on every task.
    const readyFilters = !hasData
      ? { ...effectiveFilters, customFields: null }
      : effectiveFilters;
    return (task: Task) => taskMatchesFilters(task, readyFilters, context);
  }, [
    effectiveFilters,
    project?.slug,
    textQuery,
    weekStartsOn,
    getValuesForTask,
    hasData,
    descriptionMatches,
    matchingLabelIds,
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
    key: "status" | "priority" | "assignee" | "dueDate" | "labels",
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
    customFieldValues: {
      ...customFieldValues,
      isLoading: !!effectiveFilters.customFields && customFieldValues.isLoading,
      isError: !!effectiveFilters.customFields && customFieldValues.isError,
    },
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
