import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { useEffect, useState } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

export type BoardFilters = {
  status: string[] | null;
  priority: string[] | null;
  assignee: string[] | null;
  dueDate: string[] | null;
  labels: string[] | null;
  customFields: Record<string, string[]> | null;
};

export const DUE_DATE_FILTER_VALUES = {
  dueNextWeek: "dueNextWeek",
  dueThisWeek: "dueThisWeek",
  noDueDate: "noDueDate",
} as const;

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
        normalized.customFields = value as Record<string, string[]>;
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

export function useTaskFilters(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
) {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
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

  const filterTasks = (tasks: Task[]): Task[] => {
    return tasks.filter((task) => {
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

      if (
        filters.customFields &&
        Object.keys(filters.customFields).length > 0
      ) {
        for (const [fieldId, values] of Object.entries(filters.customFields)) {
          if (values.length === 0) continue;
          const taskValue =
            task.customFieldValues?.find((v) => v.fieldId === fieldId)?.value ??
            null;
          if (!taskValue || !values.includes(taskValue)) return false;
        }
      }

      return true;
    });
  };

  const filteredProject = project
    ? {
      ...project,
      columns:
        project.columns?.map((column) => ({
          ...column,
          tasks: filterTasks(column.tasks),
        })) ?? [],
    }
    : null;

  const hasActiveFilters = Object.values(filters).some(
    (filter) => filter !== null,
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
