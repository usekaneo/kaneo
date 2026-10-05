import type { ProjectWithTasks } from "@/types/project";
import { findTaskColumn } from "./find-task-column";

export function getVisualTaskPlacement(
  project: ProjectWithTasks,
  activeId: string,
) {
  const column = findTaskColumn(project, activeId);
  if (!column) return null;

  const index = column.tasks.findIndex((task) => task.id === activeId);
  const nextTask = column.tasks[index + 1];
  if (nextTask) return { overId: nextTask.id, insertAfterTarget: false };

  const previousTask = column.tasks[index - 1];
  if (previousTask) return { overId: previousTask.id, insertAfterTarget: true };

  return { overId: column.id, insertAfterTarget: undefined };
}
