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
