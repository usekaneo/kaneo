import {
  addWeeks,
  type Day,
  endOfWeek,
  isWithinInterval,
  startOfWeek,
} from "date-fns";
import {
  type BoardFilters,
  DUE_DATE_FILTER_VALUES,
} from "@/hooks/use-task-filters";
import type Task from "@/types/task";
import { customFieldSubjectId } from "./filter-subject-id";

export type TaskFilterContext = {
  query?: string;
  projectSlug?: string;
  descriptionMatches?: ReadonlySet<string>;
  weekStartsOn: Day;
  today: Date;
  getCustomFieldValues: (
    taskId: string,
  ) => Array<{ fieldId: string; value: string | null }>;
};

function matchesQuery(task: Task, context: TaskFilterContext) {
  const query = context.query?.trim().toLowerCase();
  if (!query) return true;

  const taskNumber = task.number?.toString() ?? "";
  const identifier =
    taskNumber && context.projectSlug
      ? `${context.projectSlug}-${taskNumber}`.toLowerCase()
      : "";

  return (
    context.descriptionMatches?.has(task.id) ||
    (task.title?.toLowerCase() ?? "").includes(query) ||
    (task.description?.toLowerCase() ?? "").includes(query) ||
    taskNumber.includes(query) ||
    (identifier !== "" && identifier.startsWith(query)) ||
    (taskNumber !== "" && `#${taskNumber}`.startsWith(query))
  );
}

function matchesDueDate(
  task: Task,
  dueDateFilter: string,
  context: TaskFilterContext,
) {
  if (dueDateFilter === DUE_DATE_FILTER_VALUES.noDueDate) return !task.dueDate;
  if (!task.dueDate) return false;

  const weeksAhead =
    dueDateFilter === DUE_DATE_FILTER_VALUES.dueThisWeek
      ? 0
      : dueDateFilter === DUE_DATE_FILTER_VALUES.dueNextWeek
        ? 1
        : null;
  if (weeksAhead === null) return false;

  const reference = addWeeks(context.today, weeksAhead);
  return isWithinInterval(new Date(task.dueDate), {
    start: startOfWeek(reference, { weekStartsOn: context.weekStartsOn }),
    end: endOfWeek(reference, { weekStartsOn: context.weekStartsOn }),
  });
}

export function taskMatchesFilters(
  task: Task,
  filters: BoardFilters,
  context: TaskFilterContext,
) {
  if (!matchesQuery(task, context)) return false;

  const negated = new Set(filters.negated ?? []);
  const passes = (subject: string, matches: boolean) =>
    negated.has(subject) ? !matches : matches;
  const labelIds = (task.labels ?? []).map((label) => label.id);
  const checks: Array<[string, string[] | null | undefined, () => boolean]> = [
    [
      "status",
      filters.status,
      () => filters.status?.includes(task.status) ?? false,
    ],
    [
      "priority",
      filters.priority,
      () => filters.priority?.includes(task.priority ?? "") ?? false,
    ],
    [
      "assignee",
      filters.assignee,
      () => filters.assignee?.includes(task.userId ?? "") ?? false,
    ],
    [
      "dueDate",
      filters.dueDate,
      () =>
        filters.dueDate?.some((value) =>
          matchesDueDate(task, value, context),
        ) ?? false,
    ],
    [
      "labels",
      filters.labels,
      () => filters.labels?.some((id) => labelIds.includes(id)) ?? false,
    ],
  ];

  for (const [subject, values, matches] of checks) {
    if (values?.length && !passes(subject, matches())) return false;
  }

  const fieldValues = filters.customFields
    ? context.getCustomFieldValues(task.id)
    : [];
  return Object.entries(filters.customFields ?? {}).every(
    ([fieldId, allowed]) => {
      if (allowed.length === 0) return true;
      const value = fieldValues.find(
        (entry) => entry.fieldId === fieldId,
      )?.value;
      const matches = value != null && value !== "" && allowed.includes(value);
      return passes(customFieldSubjectId(fieldId), matches);
    },
  );
}
