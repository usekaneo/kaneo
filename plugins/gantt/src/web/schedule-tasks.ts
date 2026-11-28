import type { PluginProjectColumn, PluginTask } from "@kaneo/plugin-sdk/web";
import type { ScheduledTask } from "./scheduled-task.js";
import { parseTaskDate } from "./timeline.js";

function scheduleTask(task: PluginTask): ScheduledTask | null {
  const parsedStart =
    parseTaskDate(task.startDate) ?? parseTaskDate(task.dueDate);
  const parsedEnd =
    parseTaskDate(task.dueDate) ?? parseTaskDate(task.startDate);

  if (!parsedStart || !parsedEnd) return null;

  return {
    ...task,
    scheduleStart: parsedStart <= parsedEnd ? parsedStart : parsedEnd,
    scheduleEnd: parsedEnd >= parsedStart ? parsedEnd : parsedStart,
  };
}

export function scheduleTasks(
  tasks: readonly PluginTask[],
  columns: readonly PluginProjectColumn[],
): ScheduledTask[] {
  const columnRank = new Map(
    columns.map((column, index) => [column.slug, index]),
  );
  const rankOf = (task: PluginTask) =>
    columnRank.get(task.status) ?? columns.length;

  return tasks
    .map(scheduleTask)
    .filter((task): task is ScheduledTask => task !== null)
    .sort(
      (left, right) =>
        left.scheduleStart.getTime() - right.scheduleStart.getTime() ||
        rankOf(left) - rankOf(right),
    );
}
