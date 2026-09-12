import { parseISO } from "date-fns";

/**
 * Minimal shape a task needs to be placed on a date-based view. Kept structural
 * rather than tied to `Task` so both the typed API response and the local
 * `Task` type satisfy it.
 */
export type SchedulableTask = {
  startDate: string | null;
  dueDate: string | null;
};

export type Scheduled<TTask> = TTask & {
  scheduleStart: Date;
  scheduleEnd: Date;
};

export type ScheduleSource<TTask> = {
  columns: Array<{ tasks: TTask[] }>;
  plannedTasks: TTask[];
};

export function parseTaskDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * A task only needs one of the two dates to be schedulable: each side falls
 * back to the other, so a task with just a due date renders as a single day.
 * Reversed ranges are swapped rather than dropped.
 */
export function toScheduledTask<TTask extends SchedulableTask>(
  task: TTask,
): Scheduled<TTask> | null {
  const parsedStart =
    parseTaskDate(task.startDate) ?? parseTaskDate(task.dueDate);
  const parsedEnd =
    parseTaskDate(task.dueDate) ?? parseTaskDate(task.startDate);

  if (!parsedStart || !parsedEnd) return null;

  const scheduleStart = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
  const scheduleEnd = parsedEnd >= parsedStart ? parsedEnd : parsedStart;

  return { ...task, scheduleStart, scheduleEnd };
}

/**
 * Flattens the board columns plus planned tasks into a date-sorted list.
 * Archived tasks are intentionally excluded from schedule views.
 */
export function toScheduledTasks<TTask extends SchedulableTask>(
  source: ScheduleSource<TTask> | undefined | null,
): Array<Scheduled<TTask>> {
  const tasks = [
    ...(source?.columns.flatMap((column) => column.tasks) ?? []),
    ...(source?.plannedTasks ?? []),
  ];

  return tasks
    .map(toScheduledTask)
    .filter((task): task is Scheduled<TTask> => task !== null)
    .sort(
      (left, right) =>
        left.scheduleStart.getTime() - right.scheduleStart.getTime(),
    );
}
