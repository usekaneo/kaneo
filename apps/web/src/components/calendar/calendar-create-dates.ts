import { isAfter, startOfDay } from "date-fns";

export type CreateTaskDates = {
  startDate?: Date;
  dueDate?: Date;
};

/**
 * A single past-or-today day marks when work started; a future day is a
 * deadline. A dragged range sets both ends regardless of direction.
 */
export function getCreateTaskDates(
  from: Date,
  to: Date,
  today: Date = new Date(),
): CreateTaskDates {
  const start = startOfDay(from <= to ? from : to);
  const end = startOfDay(from <= to ? to : from);

  if (start.getTime() !== end.getTime()) {
    return { startDate: start, dueDate: end };
  }

  return isAfter(start, startOfDay(today))
    ? { dueDate: start }
    : { startDate: start };
}
