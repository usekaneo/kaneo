import type { ScheduledTask } from "./scheduled-task.js";

export function filterTasks(
  tasks: ScheduledTask[],
  query: string,
  projectSlug: string,
): ScheduledTask[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return tasks;

  return tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(normalizedQuery) ||
      `${projectSlug}-${task.number ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery) ||
      task.status.toLowerCase().includes(normalizedQuery),
  );
}
