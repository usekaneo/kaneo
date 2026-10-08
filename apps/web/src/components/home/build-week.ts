import { addDays, isSameDay, startOfDay } from "date-fns";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";

export type WeekDay = {
  date: Date;
  isToday: boolean;
  isPast: boolean;
  tasks: AssignedTask[];
};

const DAYS_BEFORE = 3;
const DAYS_AFTER = 3;

// Centred on today: the days just missed matter as much as the ones coming up.
export function buildWeek(tasks: AssignedTask[], now = new Date()): WeekDay[] {
  const today = startOfDay(now);

  return Array.from({ length: DAYS_BEFORE + DAYS_AFTER + 1 }, (_, index) => {
    const offset = index - DAYS_BEFORE;
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
