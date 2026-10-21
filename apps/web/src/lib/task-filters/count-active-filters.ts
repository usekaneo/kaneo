import type { BoardFilters } from "@/lib/task-filters/types";

export function countActiveFilters(filters: BoardFilters) {
  const listCount = (
    [
      "status",
      "priority",
      "assignee",
      "dueDate",
      "createdDate",
      "labels",
    ] as const
  ).filter((key) => (filters[key]?.length ?? 0) > 0).length;
  const customFieldCount = Object.values(filters.customFields ?? {}).filter(
    (values) => values.length > 0,
  ).length;
  return listCount + customFieldCount;
}
