import { differenceInCalendarDays } from "date-fns";
import type { AssignedTask } from "./assigned-tasks";

export const DUE_BUCKETS = [
  "overdue",
  "today",
  "thisWeek",
  "later",
  "noDueDate",
] as const;

export type DueBucket = (typeof DUE_BUCKETS)[number];

export type AssignedTaskGroup = {
  id: string;
  bucket?: DueBucket;
  title?: string;
  tasks: AssignedTask[];
};

export function getDueBucket(
  dueDate: string | null,
  now = new Date(),
): DueBucket {
  if (!dueDate) return "noDueDate";
  const days = differenceInCalendarDays(new Date(dueDate), now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "thisWeek";
  return "later";
}

export function groupByDueDate(tasks: AssignedTask[]): AssignedTaskGroup[] {
  return DUE_BUCKETS.flatMap((bucket) => {
    const group = tasks.filter((task) => getDueBucket(task.dueDate) === bucket);
    return group.length ? [{ id: bucket, bucket, tasks: group }] : [];
  });
}

export function groupByProject(tasks: AssignedTask[]): AssignedTaskGroup[] {
  const groups = new Map<string, AssignedTaskGroup>();
  for (const task of tasks) {
    const group = groups.get(task.projectId) ?? {
      id: task.projectId,
      title: task.projectName,
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(task.projectId, group);
  }
  return [...groups.values()];
}
