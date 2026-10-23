type LaneTask = { id: string; projectId: string; status: string };

/**
 * The task's project column, in order, after a global board drop: the task
 * follows the nearest task above it in the lane from the same project column,
 * or else precedes the nearest one below. With neither, a task that changed
 * column goes to the end, as on the project board; otherwise null (unchanged).
 */
export function placeInProjectColumn({
  laneTasks,
  task,
  columnIds,
  statusChanged,
}: {
  laneTasks: readonly LaneTask[];
  task: LaneTask;
  /** The project column's other task ids, in their current board order. */
  columnIds: readonly string[];
  statusChanged: boolean;
}): string[] | null {
  const index = laneTasks.findIndex((candidate) => candidate.id === task.id);
  const sameColumn = (candidate: LaneTask | undefined) =>
    candidate !== undefined &&
    candidate.id !== task.id &&
    candidate.projectId === task.projectId &&
    candidate.status === task.status &&
    columnIds.includes(candidate.id);
  const above = laneTasks
    .slice(0, Math.max(index, 0))
    .reverse()
    .find(sameColumn);
  const below = laneTasks.slice(index + 1).find(sameColumn);

  const rest = columnIds.filter((id) => id !== task.id);
  if (above) {
    const at = rest.indexOf(above.id) + 1;
    return [...rest.slice(0, at), task.id, ...rest.slice(at)];
  }
  if (below) {
    const at = rest.indexOf(below.id);
    return [...rest.slice(0, at), task.id, ...rest.slice(at)];
  }
  return statusChanged ? [...rest, task.id] : null;
}
