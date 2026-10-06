import { addDays, isSameDay, startOfDay } from "date-fns";
import type { AssignedTask } from "./assigned-tasks";

export type WeekDay = {
  date: Date;
  isToday: boolean;
  isPast: boolean;
  tasks: AssignedTask[];
};

// Centred on today, like apps/web's home/build-week.
export function buildWeek(tasks: AssignedTask[], now = new Date()): WeekDay[] {
  const today = startOfDay(now);

  return Array.from({ length: 7 }, (_, index) => {
    const offset = index - 3;
    const date = addDays(today, offset);

    return {
      date,
      isToday: offset === 0,
      isPast: offset < 0,
      tasks: tasks.filter(
        (task) => task.dueDate && isSameDay(new Date(task.dueDate), date),
      ),
    };
  });
}
