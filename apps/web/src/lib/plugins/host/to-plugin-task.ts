import type { PluginTask } from "@kaneo/plugin-sdk/web";

type DateValue = string | Date | null | undefined;

export type TaskSource = {
  id: string;
  projectId: string;
  number: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  startDate: DateValue;
  dueDate: DateValue;
};

type BoardSource = {
  columns: Array<{ tasks: TaskSource[] }>;
  plannedTasks?: TaskSource[];
};

export function toIsoDate(value: DateValue): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toPluginTask(task: TaskSource): PluginTask {
  return {
    id: task.id,
    projectId: task.projectId,
    number: task.number ?? null,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority ?? null,
    assigneeId: task.assigneeId ?? null,
    assigneeName: task.assigneeName ?? null,
    startDate: toIsoDate(task.startDate),
    dueDate: toIsoDate(task.dueDate),
  };
}

export function flattenBoardTasks(board: BoardSource): PluginTask[] {
  const seen = new Set<string>();
  const tasks: PluginTask[] = [];
  for (const task of [
    ...board.columns.flatMap((column) => column.tasks),
    ...(board.plannedTasks ?? []),
  ]) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    tasks.push(toPluginTask(task));
  }
  return tasks;
}
