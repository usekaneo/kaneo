import {
  type ScheduleSource,
  type SchedulableTask,
  toScheduledTask,
  toScheduledTasks,
} from "./task-schedule";

type CalendarRelation = {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
};

/** Group before scheduling so undated children stay attached to their parent. */
export function toCalendarTasks<T extends SchedulableTask & { id: string }>(
  source: ScheduleSource<T> | null | undefined,
  relations: readonly CalendarRelation[],
  visibleSource: ScheduleSource<{ id: string }> | null | undefined = source,
) {
  const tasks = [
    ...(source?.columns.flatMap((column) => column.tasks) ?? []),
    ...(source?.plannedTasks ?? []),
  ];
  const visibleIds = new Set([
    ...(visibleSource?.columns.flatMap((column) =>
      column.tasks.map((task) => task.id),
    ) ?? []),
    ...(visibleSource?.plannedTasks.map((task) => task.id) ?? []),
  ]);
  const taskIds = new Set(tasks.map((task) => task.id));
  const parents = new Map<string, string>();
  for (const relation of relations) {
    if (
      relation.relationType === "subtask" &&
      relation.sourceTaskId !== relation.targetTaskId &&
      taskIds.has(relation.sourceTaskId) &&
      taskIds.has(relation.targetTaskId) &&
      !parents.has(relation.targetTaskId)
    ) {
      parents.set(relation.targetTaskId, relation.sourceTaskId);
    }
  }

  const roots = new Map<string, string>();
  for (const task of tasks) {
    const path = new Set<string>();
    let id = task.id;
    while (!roots.has(id) && !path.has(id) && parents.has(id)) {
      path.add(id);
      id = parents.get(id)!;
    }
    // A malformed cycle still produces one item rather than losing tasks.
    const root = roots.get(id) ?? id;
    roots.set(id, root);
    for (const childId of path) roots.set(childId, root);
  }

  const children = new Map<string, T[]>();
  for (const task of tasks) {
    const root = roots.get(task.id)!;
    if (root === task.id || !visibleIds.has(task.id)) continue;
    const siblings = children.get(root) ?? [];
    siblings.push(task);
    children.set(root, siblings);
  }

  const grouped = tasks
    .filter(
      (task) =>
        roots.get(task.id) === task.id &&
        (visibleIds.has(task.id) || children.has(task.id)),
    )
    .map((task) => {
      const subtasks = children.get(task.id) ?? [];
      if (toScheduledTask(task) || subtasks.length === 0) {
        return { ...task, subtasks };
      }
      let start: Date | null = null;
      let end: Date | null = null;
      for (const child of subtasks) {
        const scheduled = toScheduledTask(child);
        if (!scheduled) continue;
        if (!start || scheduled.scheduleStart < start)
          start = scheduled.scheduleStart;
        if (!end || scheduled.scheduleEnd > end) end = scheduled.scheduleEnd;
      }
      return {
        ...task,
        subtasks,
        startDate: start?.toISOString() ?? null,
        dueDate: end?.toISOString() ?? null,
      };
    });

  return toScheduledTasks({ columns: [{ tasks: grouped }], plannedTasks: [] });
}
