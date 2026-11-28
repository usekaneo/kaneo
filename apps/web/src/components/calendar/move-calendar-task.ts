import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import {
  parseTaskDate,
  toScheduledTask,
  type SchedulableTask,
} from "@/lib/task-schedule";

/** Move a task without resizing it or filling an originally absent date. */
export function moveCalendarTask<TTask extends SchedulableTask>(
  task: TTask,
  targetDay: Date,
): TTask | null {
  const scheduled = toScheduledTask(task);
  if (!scheduled || Number.isNaN(targetDay.getTime())) return null;
  const deltaDays = differenceInCalendarDays(
    targetDay,
    scheduled.scheduleStart,
  );
  if (deltaDays === 0) return null;

  const shift = (value: string | null): string | null => {
    const date = parseTaskDate(value);
    return date ? startOfDay(addDays(date, deltaDays)).toISOString() : null;
  };

  return {
    ...task,
    startDate: shift(task.startDate),
    dueDate: shift(task.dueDate),
  };
}
