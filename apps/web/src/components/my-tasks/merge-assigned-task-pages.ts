import type { AssignedTasks } from "@/fetchers/task/get-assigned-tasks";

export function mergeAssignedTaskPages(pages: AssignedTasks[]): AssignedTasks {
  const tasks = new Map(
    pages.flatMap((page) => page.tasks.map((task) => [task.id, task] as const)),
  );
  return { tasks: [...tasks.values()], total: pages.at(-1)?.total ?? 0 };
}
