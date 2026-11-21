import { getPriorityValue } from "@/lib/sort-tasks";
import type Task from "@/types/task";

function compareNullable(
  left: number | null,
  right: number | null,
  nullsLast = true,
) {
  if (left === null && right === null) return 0;
  if (left === null) return nullsLast ? 1 : -1;
  if (right === null) return nullsLast ? -1 : 1;
  return left - right;
}

function time(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * The server order of the workspace board: due date first (undated last),
 * then priority, position, creation time and id. Client-side inserts use
 * it so a card lands where the next reload would put it.
 */
export function compareWorkspaceTasks(left: Task, right: Task) {
  return (
    compareNullable(time(left.dueDate), time(right.dueDate)) ||
    getPriorityValue(right.priority) - getPriorityValue(left.priority) ||
    compareNullable(left.position, right.position) ||
    compareNullable(time(left.createdAt), time(right.createdAt)) ||
    left.id.localeCompare(right.id)
  );
}

/** Insert without disturbing the order of what is already there. */
export function insertWorkspaceTask(tasks: Task[], task: Task) {
  const index = tasks.findIndex(
    (candidate) => compareWorkspaceTasks(task, candidate) < 0,
  );
  return index === -1
    ? [...tasks, task]
    : [...tasks.slice(0, index), task, ...tasks.slice(index)];
}
