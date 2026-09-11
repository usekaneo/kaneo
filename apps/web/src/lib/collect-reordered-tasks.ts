import type { TaskReorderInput } from "@/fetchers/task/reorder-tasks";
import type Task from "@/types/task";

/**
 * Diffs a board before and after a drag and returns only the tasks whose
 * column or position actually moved.
 *
 * The drag handlers rebuild the board optimistically with immer and renumber
 * the groups the drag touched; this turns that result into the smallest
 * payload the reorder endpoint needs.
 */
function collectReorderedTasks(
  before: Task[],
  after: Task[],
): TaskReorderInput[] {
  const previous = new Map(before.map((task) => [task.id, task]));

  const changed: TaskReorderInput[] = [];

  for (const task of after) {
    const original = previous.get(task.id);

    if (
      original &&
      original.status === task.status &&
      original.position === task.position
    ) {
      continue;
    }

    changed.push({
      id: task.id,
      status: task.status,
      position: task.position ?? 0,
    });
  }

  return changed;
}

export default collectReorderedTasks;
