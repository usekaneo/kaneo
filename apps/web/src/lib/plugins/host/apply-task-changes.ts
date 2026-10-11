import type { TaskChanges } from "@kaneo/plugin-sdk/web";
import type Task from "@/types/task";

export function applyTaskChanges(task: Task, changes: TaskChanges): Task {
  const next: Task = { ...task };
  if (changes.title !== undefined) next.title = changes.title;
  if (changes.description !== undefined) {
    next.description = changes.description;
    next.descriptionDeferred = false;
  }
  if (changes.status !== undefined) next.status = changes.status;
  if (changes.priority !== undefined) next.priority = changes.priority;
  if (changes.assigneeId !== undefined) {
    next.userId = changes.assigneeId;
    next.assigneeId = changes.assigneeId;
  }
  if (changes.startDate !== undefined) next.startDate = changes.startDate;
  if (changes.dueDate !== undefined) next.dueDate = changes.dueDate;
  return next;
}
