import type { GlobalBoardTasksQuery } from "@/fetchers/task/get-global-board-tasks";

export type GlobalBoardLane = GlobalBoardTasksQuery["globalStatus"];

export const GLOBAL_BOARD_FILTER_KEYS = [
  "workspaceId",
  "projectId",
  "assigneeId",
  "priority",
  "label",
  "dueDate",
] as const;

export type GlobalBoardFilterKey = (typeof GLOBAL_BOARD_FILTER_KEYS)[number];

export type GlobalBoardFilters = Partial<
  Record<GlobalBoardFilterKey, string[]>
> & {
  negate?: GlobalBoardFilterKey[];
  q?: string;
};

export const GLOBAL_BOARD_LANES = [
  "to-do",
  "in-progress",
  "done",
] as const satisfies readonly GlobalBoardLane[];

const ALLOWED: Partial<Record<GlobalBoardFilterKey, ReadonlySet<string>>> = {
  priority: new Set(["no-priority", "low", "medium", "high", "urgent"]),
  dueDate: new Set(["dueThisWeek", "dueNextWeek", "noDueDate"]),
};

const strings = (value: unknown) =>
  [value]
    .flat()
    .filter(
      (item): item is string => typeof item === "string" && !!item.trim(),
    );

// Route search params arrive untyped; keep only known, non-empty filters, and
// negations only for filters that have values.
export function parseGlobalBoardFilters(
  search: Record<string, unknown>,
): GlobalBoardFilters {
  const filters: GlobalBoardFilters = {};
  for (const key of GLOBAL_BOARD_FILTER_KEYS) {
    const values = [...new Set(strings(search[key]))].filter(
      (value) => ALLOWED[key]?.has(value) ?? true,
    );
    if (values.length) filters[key] = values;
  }
  const negate = strings(search.negate).filter(
    (key): key is GlobalBoardFilterKey =>
      (GLOBAL_BOARD_FILTER_KEYS as readonly string[]).includes(key) &&
      !!filters[key as GlobalBoardFilterKey],
  );
  if (negate.length) filters.negate = [...new Set(negate)];
  const q = strings(search.q)[0];
  if (q) filters.q = q;
  return filters;
}

export function setFilterValues(
  filters: GlobalBoardFilters,
  key: GlobalBoardFilterKey,
  values: string[] | undefined,
): GlobalBoardFilters {
  const next = { ...filters, [key]: values?.length ? values : undefined };
  if (!values?.length) next.negate = filters.negate?.filter((k) => k !== key);
  return parseGlobalBoardFilters(next);
}

export function toggleFilterValue(
  filters: GlobalBoardFilters,
  key: GlobalBoardFilterKey,
  value: string,
): GlobalBoardFilters {
  const current = filters[key] ?? [];
  return setFilterValues(
    filters,
    key,
    current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value],
  );
}

// Labels from different workspaces match by name, ignoring case.
export function hasLabel(filters: GlobalBoardFilters, name: string) {
  const lower = name.toLowerCase();
  return (filters.label ?? []).some((label) => label.toLowerCase() === lower);
}

export function toggleLabel(
  filters: GlobalBoardFilters,
  name: string,
): GlobalBoardFilters {
  const lower = name.toLowerCase();
  const current = filters.label ?? [];
  return setFilterValues(
    filters,
    "label",
    hasLabel(filters, name)
      ? current.filter((label) => label.toLowerCase() !== lower)
      : [...current, name],
  );
}

export function setFilterNegated(
  filters: GlobalBoardFilters,
  key: GlobalBoardFilterKey,
  negated: boolean,
): GlobalBoardFilters {
  const rest = (filters.negate ?? []).filter((item) => item !== key);
  return parseGlobalBoardFilters({
    ...filters,
    negate: negated ? [...rest, key] : rest,
  });
}

export function countActiveFilters(filters: GlobalBoardFilters) {
  return GLOBAL_BOARD_FILTER_KEYS.filter((key) => filters[key]?.length).length;
}
