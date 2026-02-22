import { useQueryClient } from "@tanstack/react-query";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import type { BoardFilters } from "./use-task-filters";

const DEFAULT_FILTERS: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
};

const FILTER_KEYS: Array<keyof BoardFilters> = [
  "status",
  "priority",
  "assignee",
  "dueDate",
  "labels",
];

function normalizeFilters(raw: unknown): BoardFilters {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_FILTERS;
  }

  const candidate = raw as Partial<Record<keyof BoardFilters, unknown>>;
  const normalized = { ...DEFAULT_FILTERS };

  for (const key of FILTER_KEYS) {
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
  const queryClient = useQueryClient();
  const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);

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

  // Helper function to get cached labels for a task
  const getTaskLabels = useCallback(
    (taskId: string) => {
      const queryKey = ["labels", taskId];
      const cachedData = queryClient.getQueryData(queryKey) as
        | Array<{ id: string; name: string; color: string }>
        | undefined;
      return cachedData || [];
    },
    [queryClient],
  );

  const filterTasks = useCallback(
    (tasks: Task[]): Task[] => {
      const normalizedTextQuery = textQuery?.trim().toLowerCase();

      return tasks.filter((task) => {
        if (normalizedTextQuery) {
          const title = task.title?.toLowerCase() ?? "";
          const description = task.description?.toLowerCase() ?? "";
          const matchesText =
            title.includes(normalizedTextQuery) ||
            description.includes(normalizedTextQuery);

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
            if (dueDateFilter === "No due date") {
              return !task.dueDate;
            }

            if (!taskDate) {
              return false;
            }

            switch (dueDateFilter) {
              case "Due this week": {
                const weekStart = startOfWeek(today);
                const weekEnd = endOfWeek(today);
                return isWithinInterval(taskDate, {
                  start: weekStart,
                  end: weekEnd,
                });
              }
              case "Due next week": {
                const nextWeekStart = startOfWeek(addWeeks(today, 1));
                const nextWeekEnd = endOfWeek(addWeeks(today, 1));
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
          const taskLabels = getTaskLabels(task.id);
          const taskLabelIds = taskLabels.map((label) => label.id);

          // Check if task has at least one of the selected labels
          const hasMatchingLabel = filters.labels.some((labelId) =>
            taskLabelIds.includes(labelId),
          );

          if (!hasMatchingLabel) {
            return false;
          }
        }

        return true;
      });
    },
    [filters, getTaskLabels, textQuery],
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

  return {
    filters,
    setFilters,
    updateFilter,
    updateLabelFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  };
}
