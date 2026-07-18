import { useEffect, useState } from "react";
import type { SortConfig, SortDirection, SortField } from "@/lib/sort-tasks";

const DEFAULT_SORT: SortConfig = {
  field: "position",
  direction: "asc",
};

const SORT_FIELD_MAP: Record<SortField, true> = {
  position: true,
  createdAt: true,
  priority: true,
  dueDate: true,
  title: true,
  number: true,
};

const SORT_FIELDS = Object.keys(SORT_FIELD_MAP) as readonly SortField[];

const SORT_DIRECTION_MAP: Record<SortDirection, true> = {
  asc: true,
  desc: true,
};

const SORT_DIRECTIONS = Object.keys(
  SORT_DIRECTION_MAP,
) as readonly SortDirection[];

function isSortField(value: unknown): value is SortField {
  return SORT_FIELDS.includes(value as SortField);
}

function isSortDirection(value: unknown): value is SortDirection {
  return SORT_DIRECTIONS.includes(value as SortDirection);
}

function normalizeSort(value: unknown): SortConfig {
  if (!value || typeof value !== "object") {
    return DEFAULT_SORT;
  }

  const candidate = value as Partial<Record<keyof SortConfig, unknown>>;

  if (!isSortField(candidate.field) || !isSortDirection(candidate.direction)) {
    return DEFAULT_SORT;
  }

  return { field: candidate.field, direction: candidate.direction };
}

export function useBoardSort(projectId: string | undefined) {
  const storageKey = projectId ? `kaneo:board-sort:${projectId}` : null;
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setSort(DEFAULT_SORT);
        return;
      }

      const parsed = JSON.parse(stored) as unknown;
      setSort(normalizeSort(parsed));
    } catch {
      setSort(DEFAULT_SORT);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(sort));
  }, [sort, storageKey]);

  return { sort, setSort };
}
