import type { SortConfig, SortDirection, SortField } from "@/lib/sort-tasks";
import { useStoredState } from "./use-stored-state";

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

export function useBoardSort(
  projectId: string | undefined,
  scope: "board" | "backlog" = "board",
) {
  const [sort, setSort] = useStoredState(
    projectId ? `kaneo:${scope}-sort:${projectId}` : null,
    normalizeSort,
    DEFAULT_SORT,
  );
  return { sort, setSort };
}
