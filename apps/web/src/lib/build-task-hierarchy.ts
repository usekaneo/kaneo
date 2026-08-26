import type Task from "@/types/task";

export type TaskHierarchyNode = {
  task: Task;
  children: TaskHierarchyNode[];
};

type SubtaskRelation = {
  sourceTaskId: string;
  targetTaskId: string;
};

export function buildTaskHierarchy(
  tasks: Task[],
  relations: SubtaskRelation[],
): TaskHierarchyNode[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const taskOrder = new Map(tasks.map((task, index) => [task.id, index]));
  const childIds = new Set<string>();
  const childrenByParent = new Map<string, string[]>();
  const relatedIds = new Set<string>();

  for (const relation of relations) {
    const hasParent = tasksById.has(relation.sourceTaskId);
    const hasChild = tasksById.has(relation.targetTaskId);

    if (relation.sourceTaskId === relation.targetTaskId) {
      continue;
    }

    if (hasParent) relatedIds.add(relation.sourceTaskId);
    if (hasChild) relatedIds.add(relation.targetTaskId);
    if (!hasParent || !hasChild) continue;

    const children = childrenByParent.get(relation.sourceTaskId) ?? [];
    if (!children.includes(relation.targetTaskId)) {
      children.push(relation.targetTaskId);
      childrenByParent.set(relation.sourceTaskId, children);
      childIds.add(relation.targetTaskId);
    }
  }

  const renderedIds = new Set<string>();

  const buildNode = (
    taskId: string,
    ancestors: Set<string>,
  ): TaskHierarchyNode => {
    const task = tasksById.get(taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);

    const nextAncestors = new Set(ancestors).add(taskId);
    const children = (childrenByParent.get(taskId) ?? [])
      .filter((childId) => !nextAncestors.has(childId))
      .sort(
        (a, b) =>
          (taskOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
          (taskOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
      )
      .map((childId) => buildNode(childId, nextAncestors));

    renderedIds.add(taskId);
    return { task, children };
  };

  const roots = tasks
    .filter((task) => relatedIds.has(task.id) && !childIds.has(task.id))
    .map((task) => buildNode(task.id, new Set()));

  // Invalid legacy data may contain a cycle. Keep it visible instead of
  // returning an empty view, while ancestor tracking prevents recursion.
  for (const task of tasks) {
    if (relatedIds.has(task.id) && !renderedIds.has(task.id)) {
      roots.push(buildNode(task.id, new Set()));
    }
  }

  return roots;
}
