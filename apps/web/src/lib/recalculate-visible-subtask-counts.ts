import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

/**
 * Recompute direct/completed subtask counts from the tasks currently present
 * in the project payload (e.g. after client-side board filters/search).
 * Counts only children that remain in board columns.
 */
export function recalculateVisibleSubtaskCounts(
  project: ProjectWithTasks,
): ProjectWithTasks {
  const boardTasks = project.columns.flatMap((column) => column.tasks);
  const taskIds = new Set(boardTasks.map((task) => task.id));
  const finalColumnSlugs = new Set(
    project.columns
      .filter((column) => column.isFinal)
      .map((column) => column.id),
  );

  const childrenByParent = new Map<string, Task[]>();
  for (const task of boardTasks) {
    if (!task.parentId || !taskIds.has(task.parentId)) {
      continue;
    }
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task);
    childrenByParent.set(task.parentId, children);
  }

  const enrich = (task: Task): Task => {
    const children = childrenByParent.get(task.id) ?? [];
    return {
      ...task,
      directSubtaskCount: children.length,
      completedSubtaskCount: children.filter((child) =>
        finalColumnSlugs.has(child.status),
      ).length,
    };
  };

  return {
    ...project,
    columns: project.columns.map((column) => ({
      ...column,
      tasks: column.tasks.map(enrich),
    })),
  };
}
