import { addWeeks, endOfWeek, startOfWeek } from "date-fns";
import type { WorkspaceBoardQuery } from "@/fetchers/task/get-workspace-board";
import {
  type BoardFilters,
  DUE_DATE_FILTER_VALUES,
} from "@/hooks/use-task-filters";
import {
  type FilterLabel,
  groupLabels,
  isLabelGroupSelected,
} from "@/lib/task-filters/label-groups";

type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function joinIds(values: string[] | null | undefined) {
  return values && values.length > 0 ? values.join(",") : undefined;
}

/**
 * Translate the board's client-side filters into the server query so only
 * matching tasks travel. The server only narrows: "is not" filters and "no due
 * date" stay client-side, and the client pass runs over the result either way.
 */
export function toWorkspaceBoardQuery(
  filters: BoardFilters,
  includeCompleted: boolean,
  options: {
    now?: Date;
    weekStartsOn?: WeekStartsOn;
    /** Workspace labels, to send one id per selected label group. */
    labels?: FilterLabel[];
  } = {},
): WorkspaceBoardQuery {
  const now = options.now ?? new Date();
  const weekStartsOn = options.weekStartsOn ?? 1;
  const negated = new Set(filters.negated ?? []);
  const positive = <K extends keyof BoardFilters>(key: K) =>
    negated.has(key) ? null : filters[key];
  const dueDate = positive("dueDate") ?? [];
  const selectedLabels = positive("labels");
  const labelIds =
    selectedLabels && options.labels
      ? groupLabels(options.labels)
          .filter((group) =>
            isLabelGroupSelected(options.labels ?? [], group, selectedLabels),
          )
          .map((group) => group.id)
      : selectedLabels;

  const ranges: Array<{ from: Date; to: Date }> = [];
  if (dueDate.includes(DUE_DATE_FILTER_VALUES.dueThisWeek)) {
    ranges.push({
      from: startOfWeek(now, { weekStartsOn }),
      to: endOfWeek(now, { weekStartsOn }),
    });
  }
  if (dueDate.includes(DUE_DATE_FILTER_VALUES.dueNextWeek)) {
    const nextWeek = addWeeks(now, 1);
    ranges.push({
      from: startOfWeek(nextWeek, { weekStartsOn }),
      to: endOfWeek(nextWeek, { weekStartsOn }),
    });
  }
  // Selected values are alternatives, so the server may only narrow by date
  // when every one of them is a week: "no due date" and custom conditions
  // match tasks outside the weeks.
  const onlyWeeks = dueDate.length === ranges.length;
  const range =
    ranges.length > 0 && onlyWeeks
      ? {
          from: new Date(Math.min(...ranges.map((r) => r.from.getTime()))),
          to: new Date(Math.max(...ranges.map((r) => r.to.getTime()))),
        }
      : undefined;

  return {
    projectIds: joinIds(positive("project")),
    assigneeIds: joinIds(positive("assignee")),
    status: joinIds(positive("status")),
    priority: joinIds(positive("priority")),
    labelIds: joinIds(labelIds),
    dueAfter: range?.from.toISOString(),
    dueBefore: range?.to.toISOString(),
    includeCompleted: includeCompleted ? "true" : "false",
  };
}
