import type { SortConfig, SortField } from "@/lib/sort-tasks";

export const SORT_FIELDS: SortField[] = [
  "position",
  "createdAt",
  "priority",
  "dueDate",
  "title",
  "number",
];

export const MANUAL_SORT: SortConfig = { field: "position", direction: "asc" };

export function nextSortForField(field: SortField): SortConfig {
  if (field === "position") return MANUAL_SORT;
  return { field, direction: field === "priority" ? "desc" : "asc" };
}

export function normalizeSort(value: unknown): SortConfig {
  if (!value || typeof value !== "object") return MANUAL_SORT;
  const candidate = value as Partial<Record<keyof SortConfig, unknown>>;
  if (
    !SORT_FIELDS.includes(candidate.field as SortField) ||
    (candidate.direction !== "asc" && candidate.direction !== "desc")
  )
    return MANUAL_SORT;
  return {
    field: candidate.field as SortField,
    direction: candidate.direction,
  };
}
