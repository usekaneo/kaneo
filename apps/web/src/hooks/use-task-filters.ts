import { useEffect, useState } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { taskMatchesFilters } from "@/lib/task-filters/task-matches-filters";

export type BoardFilters = {
  status: string[] | null;
  priority: string[] | null;
  assignee: string[] | null;
  dueDate: string[] | null;
  startDate?: string[] | null;
  labels: string[] | null;
  customFields: Record<string, string[]> | null;
  negated?: string[] | null;
};

export { DUE_DATE_FILTER_VALUES } from "@/lib/task-filters/due-date-filter-values";

const DEFAULT_FILTERS: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  startDate: null,
  labels: null,
  customFields: null,
};

const FILTER_KEYS: Array<keyof BoardFilters> = [
  "status",
  "priority",
  "assignee",
  "dueDate",
  "startDate",
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
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch {
      // Storage may be unavailable or full; keep filters working in memory.
    }
  }, [filters, storageKey]);

  const filterTasks = (tasks: Task[]): Task[] => {
    return tasks.filter((task) =>
      taskMatchesFilters(task, filters, {
        today: new Date(),
        weekStartsOn,
        getCustomFieldValues: () => task.customFieldValues ?? [],
      }),
    );
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
