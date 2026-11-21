import type { BoardFilters } from "@/hooks/use-task-filters";
import { setSubjectNegated } from "@/lib/task-filters/set-subject-negated";
import { toggleFilterValue } from "@/lib/task-filters/toggle-filter-value";

const isAssigneeNegated = (filters: Pick<BoardFilters, "negated">) =>
  filters.negated?.includes("assignee") ?? false;

/** The avatars mean "show these people"; an "is not" filter shows none pressed. */
export function quickFilterSelection(
  filters: Pick<BoardFilters, "assignee" | "negated">,
) {
  return isAssigneeNegated(filters) ? [] : (filters.assignee ?? []);
}

/**
 * Toggle one person from the quick filter. Coming from an "is not" assignee
 * filter, a click starts over with just that person instead of excluding them.
 */
export function toggleQuickFilterAssignee(
  filters: BoardFilters,
  userId: string,
): BoardFilters {
  if (isAssigneeNegated(filters)) {
    return {
      ...filters,
      assignee: [userId],
      negated: setSubjectNegated(filters.negated, "assignee", false),
    };
  }
  const assignee = toggleFilterValue(filters.assignee, userId);
  return {
    ...filters,
    assignee,
    negated: assignee
      ? filters.negated
      : setSubjectNegated(filters.negated, "assignee", false),
  };
}
