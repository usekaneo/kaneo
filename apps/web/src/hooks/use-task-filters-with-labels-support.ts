import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import useGetCachedCustomFieldValues from "./queries/custom-field/use-get-all-custom-field-values-by-project";
import { type BoardFilters, DUE_DATE_FILTER_VALUES } from "./use-task-filters";

const DEFAULT_FILTERS: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
  customFields: null,
};

const FILTER_KEYS: Array<keyof BoardFilters> = [
  "status",
  "priority",
  "assignee",
  "dueDate",
  "labels",
  "customFields",
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
) {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);
  const { getValuesForTask } = useGetCachedCustomFieldValues();

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setFilters(DEFAULT_FILTERS);
        return;
      }

      const parsed = JSON.parse(stored) as unknown;
      setFilters(normalizeFilters(parsed));
    } catch {
      setFilters(DEFAULT_FILTERS);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(filters));
  }, [filters, storageKey]);

  const filterTasks = useCallback(
    (tasks: Task[]): Task[] => {
      const normalizedTextQuery = textQuery?.trim().toLowerCase();

      return tasks.filter((task) => {
        if (normalizedTextQuery) {
          const title = task.title?.toLowerCase() ?? "";
          const description = task.description?.toLowerCase() ?? "";
          const taskNumber = task.number?.toString() ?? "";
          const taskIdentifier =
            taskNumber && project?.slug
              ? `${project.slug}-${taskNumber}`.toLowerCase()
              : "";
          const taskShortIdentifier = taskNumber ? `#${taskNumber}` : "";
          const matchesText =
            title.includes(normalizedTextQuery) ||
            description.includes(normalizedTextQuery) ||
            taskNumber.includes(normalizedTextQuery) ||
            taskIdentifier.startsWith(normalizedTextQuery) ||
            taskShortIdentifier.startsWith(normalizedTextQuery);

          if (!matchesText) {
            return false;
          }
        }

        if (
          filters.status &&
          filters.status.length > 0 &&
          !filters.status.includes(task.status)
        ) {
          return false;
        }

        if (
          filters.priority &&
          filters.priority.length > 0 &&
          !filters.priority.includes(task.priority ?? "")
        ) {
          return false;
        }

        if (
          filters.assignee &&
          filters.assignee.length > 0 &&
          !filters.assignee.includes(task.userId ?? "")
        ) {
          return false;
        }

        if (filters.dueDate && filters.dueDate.length > 0) {
          const today = new Date();
          const taskDate = task.dueDate ? new Date(task.dueDate) : null;

          const matchesAnyDueDate = filters.dueDate.some((dueDateFilter) => {
            if (dueDateFilter === DUE_DATE_FILTER_VALUES.noDueDate) {
              return !task.dueDate;
            }

            if (!taskDate) {
              return false;
            }

            switch (dueDateFilter) {
              case DUE_DATE_FILTER_VALUES.dueThisWeek: {
                const weekStart = startOfWeek(today, { weekStartsOn });
                const weekEnd = endOfWeek(today, { weekStartsOn });
                return isWithinInterval(taskDate, {
                  start: weekStart,
                  end: weekEnd,
                });
              }
              case DUE_DATE_FILTER_VALUES.dueNextWeek: {
                const nextWeekStart = startOfWeek(addWeeks(today, 1), {
                  weekStartsOn,
                });
                const nextWeekEnd = endOfWeek(addWeeks(today, 1), {
                  weekStartsOn,
                });
                return isWithinInterval(taskDate, {
                  start: nextWeekStart,
                  end: nextWeekEnd,
                });
              }
              default:
                return false;
            }
          });

          if (!matchesAnyDueDate) {
            return false;
          }
        }

        // Label filtering
        if (filters.labels && filters.labels.length > 0) {
          const taskLabelIds = (task.labels ?? []).map((label) => label.id);

          // Check if task has at least one of the selected labels
          const hasMatchingLabel = filters.labels.some((labelId) =>
            taskLabelIds.includes(labelId),
          );

          if (!hasMatchingLabel) {
            return false;
          }
        }

        if (
          filters.customFields &&
          Object.keys(filters.customFields).length > 0
        ) {
          const taskFieldValues = getValuesForTask(task.id);
          const matchesAllFields = Object.entries(filters.customFields).every(
            ([fieldId, allowedValues]) => {
              const fieldEntry = taskFieldValues.find(
                (v) => v.fieldId === fieldId,
              );
              if (!fieldEntry?.value) return false;
              return allowedValues.includes(fieldEntry.value);
            },
          );
          if (!matchesAllFields) return false;
        }

        return true;
      });
    },
    [filters, project?.slug, textQuery, weekStartsOn, getValuesForTask],
  );

  const filteredProject = useMemo(() => {
    if (!project) return null;

    return {
      ...project,
      columns:
        project.columns?.map((column) => ({
          ...column,
          tasks: filterTasks(column.tasks),
        })) ?? [],
    };
  }, [project, filterTasks]);

  const hasActiveFilters = Object.values(filters).some((filter) =>
    Array.isArray(filter) ? filter.length > 0 : filter !== null,
  );

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const updateFilter = (
    key: keyof BoardFilters,
    value: BoardFilters[keyof BoardFilters],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateLabelFilter = (labelId: string) => {
    setFilters((prev) => {
      const currentLabels = prev.labels || [];
      const isSelected = currentLabels.includes(labelId);

      let newLabels: string[] | null;
      if (isSelected) {
        newLabels = currentLabels.filter((id) => id !== labelId);
        if (newLabels.length === 0) newLabels = null;
      } else {
        newLabels = [...currentLabels, labelId];
      }

      return { ...prev, labels: newLabels };
    });
  };

  const updateCustomFieldFilter = (fieldId: string, value: string) => {
    setFilters((prev) => {
      const current = prev.customFields ?? {};
      const existing = current[fieldId] ?? [];
      const isSelected = existing.includes(value);
      const next = isSelected
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      const updated = { ...current, [fieldId]: next };
      if (updated[fieldId].length === 0) delete updated[fieldId];
      return {
        ...prev,
        customFields: Object.keys(updated).length > 0 ? updated : null,
      };
    });
  };

  return {
    filters,
    setFilters,
    updateFilter,
    updateLabelFilter,
    updateCustomFieldFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  };
}
